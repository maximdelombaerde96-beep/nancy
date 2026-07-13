// ============================================================================
//  Client-side upload van opgenomen audio naar tijdelijke opslag.
//
//  Doel: lange oudergesprekken (30–60+ min) betrouwbaar uploaden, ook bij
//  trage of haperende verbindingen, zonder dat de opname verloren gaat of de
//  UI eindeloos blijft hangen:
//    - retry met exponentiële backoff (transiënte 5xx/netwerkfouten)
//    - een "stall-watchdog": als er te lang géén voortgang is, breken we de
//      poging af i.p.v. eindeloos te blijven wachten (bv. bij een endpoint die
//      structureel 503 geeft) → nieuwe poging of duidelijke fout + retry-knop
//    - chunked/hervatbare PUT-uploads voor de generieke opslag
//    - Vercel Blob standaard als één gewone PUT (niet multipart): de
//      multipart-endpoint (mpu) bleek structureel 503 te geven en is voor onze
//      bestandsgroottes onnodig; multipart enkel voor écht grote bestanden
//    - annuleerbaar via een AbortSignal
// ============================================================================

// Grootte per chunk voor de generieke PUT-opslag.
export const CHUNK_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_POGINGEN = 5;
const MAX_BACKOFF_MS = 15000;

// Boven deze grootte gebruikt Vercel Blob multipart (parallelle delen). Onze
// opnames (webm/opus ≈ 0,5–1 MB/min) blijven ook bij 60+ min ruim hieronder,
// dus in de praktijk uploaden we altijd als één gewone PUT en vermijden we de
// mpu-endpoint volledig.
const BLOB_MULTIPART_DREMPEL = 100 * 1024 * 1024; // 100 MB

// Als een upload-poging langer dan dit géén voortgang maakt, beschouwen we ze
// als "vastgelopen" en breken we af (retry-baar). Zo blijft de UI nooit
// eindeloos op 0% hangen, ook niet als een endpoint blijft falen zonder ooit
// bytes te versturen. Override-baar in tests.
function stallMs(): number {
  const t = (globalThis as { __OPNAME_STALL_MS__?: number }).__OPNAME_STALL_MS__;
  return typeof t === "number" && t > 0 ? t : 20000;
}

// Bestand mag hoogstens zo groot zijn voor de fallback via onze eigen route
// (Vercel serverless body-limiet ≈ 4,5 MB).
export const FALLBACK_MAX_BYTES = 4 * 1024 * 1024;

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

// Eén HTTP PUT met echte upload-voortgang (via XHR), annuleerbaar én met een
// stall-watchdog: als er stallMs() lang geen voortgang is, wordt de poging
// afgebroken met een (retry-bare) time-outfout i.p.v. eindeloos te wachten.
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

    let gestald = false;
    let watchdog: ReturnType<typeof setTimeout>;
    const herstartWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        gestald = true;
        xhr.abort();
      }, stallMs());
    };

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const opruimen = () => {
      clearTimeout(watchdog);
      signal?.removeEventListener("abort", onAbort);
    };

    xhr.upload.onprogress = (e) => {
      herstartWatchdog();
      if (onProgress && e.lengthComputable) onProgress(e.loaded);
    };
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
      if (gestald) {
        reject(new Error("Upload reageert niet (time-out)."));
      } else {
        reject(new DOMException("Geannuleerd", "AbortError"));
      }
    };
    herstartWatchdog();
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

// De werkelijke Vercel-Blob-uploadfunctie. Injecteerbaar voor tests (zonder
// echte Vercel-dienst) via window.__OPNAME_BLOB_UPLOADER__.
type BlobUploadOpts = {
  access: "public";
  contentType: string;
  handleUploadUrl: string;
  multipart: boolean;
  abortSignal?: AbortSignal;
  onUploadProgress?: (e: { loaded: number; total: number; percentage: number }) => void;
};
type BlobUploader = (
  pathname: string,
  body: Blob,
  options: BlobUploadOpts
) => Promise<{ url: string }>;

async function getBlobUploader(): Promise<BlobUploader> {
  const test = (globalThis as { __OPNAME_BLOB_UPLOADER__?: BlobUploader })
    .__OPNAME_BLOB_UPLOADER__;
  if (typeof test === "function") return test;
  const mod = await import("@vercel/blob/client");
  return mod.upload as unknown as BlobUploader;
}

// Vercel Blob via de officiële client-upload-flow. Standaard als één gewone PUT
// (multipart pas > 100 MB) om de structureel falende mpu-endpoint te vermijden.
// Met stall-watchdog + retry, zodat een blijvend falende dienst niet eindeloos
// op 0% blijft hangen maar na de pogingen een duidelijke fout oplevert.
async function blobUpload(
  pathname: string,
  blob: Blob,
  opts: UploadOpties
): Promise<string> {
  const uploader = await getBlobUploader();
  const multipart = blob.size > BLOB_MULTIPART_DREMPEL;

  return withRetry(
    async () => {
      // Interne controller: aborten we zelf bij een stall, of extern (gebruiker).
      const intern = new AbortController();
      let gestald = false;
      const onExtern = () => intern.abort();
      opts.signal?.addEventListener("abort", onExtern, { once: true });

      let watchdog: ReturnType<typeof setTimeout> | undefined;
      const herstartWatchdog = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          gestald = true;
          intern.abort();
        }, stallMs());
      };
      herstartWatchdog();

      try {
        const res = await uploader(pathname, blob, {
          access: "public",
          contentType: blob.type || "audio/webm",
          handleUploadUrl: "/api/opname/blob-upload",
          multipart,
          abortSignal: intern.signal,
          onUploadProgress: (e) => {
            herstartWatchdog();
            opts.onProgress?.(Math.round(e.percentage));
          },
        });
        return res.url;
      } catch (err) {
        // Door onze eigen stall-watchdog afgebroken → retry-bare fout.
        if (gestald) {
          throw new Error("Upload reageert niet (time-out).");
        }
        // Extern (gebruiker) geannuleerd → doorgeven, geen retry.
        if (opts.signal?.aborted) {
          throw new DOMException("Geannuleerd", "AbortError");
        }
        throw err;
      } finally {
        clearTimeout(watchdog);
        opts.signal?.removeEventListener("abort", onExtern);
      }
    },
    { pogingen: 3, signal: opts.signal, onRetry: opts.onRetry }
  );
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
