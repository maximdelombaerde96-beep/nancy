// ============================================================================
//  Client-side upload van opgenomen audio naar tijdelijke opslag.
//
//  Doel: lange oudergesprekken (30–60+ min) betrouwbaar uploaden, ook bij
//  trage of haperende verbindingen, zonder dat de opname verloren gaat:
//    - retry met exponentiële backoff (transiënte 5xx/netwerkfouten)
//    - chunked/hervatbare PUT-uploads (een hapering herstart niet alles)
//    - Vercel Blob via de officiële client-upload-flow met multipart:true
//    - annuleerbaar via een AbortSignal
// ============================================================================

// Grootte per chunk voor de generieke PUT-opslag. Groot genoeg om overhead te
// beperken, klein genoeg dat een hapering weinig werk kost om over te doen.
export const CHUNK_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_POGINGEN = 5;
const MAX_BACKOFF_MS = 15000;

export interface UploadDoel {
  mode: "blob" | "put" | "none";
  uploadUrl?: string;
  downloadUrl?: string;
  pathname?: string;
}

export interface UploadResultaat {
  mode: string;
  url: string | null;
}

export interface UploadOpties {
  onProgress?: (pct: number) => void;
  // Wordt aangeroepen vóór elke nieuwe poging (voor status/logging in de UI).
  onRetry?: (poging: number, maxPogingen: number, wachtMs: number) => void;
  signal?: AbortSignal;
}

function isAbort(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === "AbortError";
}

function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Geannuleerd", "AbortError"));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(new DOMException("Geannuleerd", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// Voert `fn` uit met exponentiële backoff (+ jitter). Aborts en de laatste
// fout worden doorgegooid; transiënte fouten leiden tot een nieuwe poging.
export async function withRetry<T>(
  fn: (poging: number) => Promise<T>,
  opts: {
    pogingen?: number;
    signal?: AbortSignal;
    onRetry?: (poging: number, maxPogingen: number, wachtMs: number) => void;
  } = {}
): Promise<T> {
  const max = opts.pogingen ?? MAX_POGINGEN;
  let laatsteFout: unknown;
  for (let poging = 1; poging <= max; poging++) {
    if (opts.signal?.aborted) {
      throw new DOMException("Geannuleerd", "AbortError");
    }
    try {
      return await fn(poging);
    } catch (err) {
      if (isAbort(err)) throw err;
      laatsteFout = err;
      if (poging >= max) break;
      const basis = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (poging - 1));
      const wacht = basis + Math.floor(Math.random() * 400);
      opts.onRetry?.(poging + 1, max, wacht);
      await sleepAbortable(wacht, opts.signal);
    }
  }
  throw laatsteFout;
}

// Eén HTTP PUT met echte upload-voortgang (via XHR) en annuleerbaar.
function putMetVoortgang(
  url: string,
  body: Blob,
  onProgress: ((geladen: number) => void) | undefined,
  signal: AbortSignal | undefined
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Geannuleerd", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", body.type || "audio/webm");

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const opruimen = () => signal?.removeEventListener("abort", onAbort);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded);
      };
    }
    xhr.onload = () => {
      opruimen();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload mislukt (${xhr.status}).`));
    };
    xhr.onerror = () => {
      opruimen();
      reject(new Error("Netwerkfout tijdens de upload."));
    };
    xhr.onabort = () => {
      opruimen();
      reject(new DOMException("Geannuleerd", "AbortError"));
    };
    xhr.send(body);
  });
}

// Chunked/hervatbare PUT naar een generieke opslag.
//   - elk deel gaat naar `${uploadUrl}?part=<index>` (met eigen retry)
//   - afsluiten met `${uploadUrl}?complete=<aantal>`
// Een hapering herstart enkel het lopende deel, niet de volledige upload.
async function chunkedPut(
  uploadUrl: string,
  blob: Blob,
  opts: UploadOpties
): Promise<void> {
  const totaal = blob.size;
  const aantal = Math.max(1, Math.ceil(totaal / CHUNK_BYTES));
  let voltooideBytes = 0;

  const sep = uploadUrl.includes("?") ? "&" : "?";

  for (let i = 0; i < aantal; i++) {
    const start = i * CHUNK_BYTES;
    const eind = Math.min(start + CHUNK_BYTES, totaal);
    const deel = blob.slice(start, eind);
    const deelUrl = `${uploadUrl}${sep}part=${i}`;

    await withRetry(
      () =>
        putMetVoortgang(
          deelUrl,
          deel,
          (geladen) => {
            const pct = Math.round(((voltooideBytes + geladen) / totaal) * 100);
            opts.onProgress?.(Math.min(99, pct));
          },
          opts.signal
        ),
      { signal: opts.signal, onRetry: opts.onRetry }
    );

    voltooideBytes += deel.size;
    opts.onProgress?.(Math.min(99, Math.round((voltooideBytes / totaal) * 100)));
  }

  // Upload afsluiten (samenvoegen server-side). Ook met retry.
  await withRetry(
    async () => {
      const res = await fetch(`${uploadUrl}${sep}complete=${aantal}`, {
        method: "POST",
        signal: opts.signal,
      });
      if (!res.ok) throw new Error(`Afronden mislukt (${res.status}).`);
    },
    { signal: opts.signal, onRetry: opts.onRetry }
  );

  opts.onProgress?.(100);
}

// Vercel Blob via de officiële client-upload-flow. multipart:true zorgt voor
// automatische chunking + hervatten van grote bestanden en lost de 503's op
// die bij één grote PUT konden optreden.
async function blobUpload(
  pathname: string,
  blob: Blob,
  opts: UploadOpties
): Promise<string> {
  const { upload } = await import("@vercel/blob/client");
  const res = await withRetry(
    () =>
      upload(pathname, blob, {
        access: "public",
        contentType: blob.type || "audio/webm",
        handleUploadUrl: "/api/opname/blob-upload",
        multipart: true,
        abortSignal: opts.signal,
        onUploadProgress: (e: { percentage: number }) =>
          opts.onProgress?.(Math.round(e.percentage)),
      }),
    { signal: opts.signal, onRetry: opts.onRetry }
  );
  return res.url;
}

// Vraagt het upload-doel op bij onze server (die de opslagkeuze maakt).
export async function haalUploadDoel(signal?: AbortSignal): Promise<UploadDoel> {
  const res = await fetch("/api/opname/upload-url", { method: "POST", signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.message || "Kon geen upload-doel krijgen.");
  }
  return data as UploadDoel;
}

// Orkestreert de volledige upload voor een gegeven doel en geeft de publieke
// URL terug (of { mode:"none" } als er geen directe opslag is → fallback).
export async function uploadNaarOpslag(
  blob: Blob,
  doel: UploadDoel,
  opts: UploadOpties = {}
): Promise<UploadResultaat> {
  if (doel.mode === "none") return { mode: "none", url: null };

  if (doel.mode === "put") {
    if (!doel.uploadUrl || !doel.downloadUrl) {
      throw new Error("Onvolledig upload-doel ontvangen.");
    }
    await chunkedPut(doel.uploadUrl, blob, opts);
    return { mode: "put", url: doel.downloadUrl };
  }

  if (doel.mode === "blob") {
    if (!doel.pathname) throw new Error("Onvolledig upload-doel ontvangen.");
    const url = await blobUpload(doel.pathname, blob, opts);
    return { mode: "blob", url };
  }

  return { mode: "none", url: null };
}
