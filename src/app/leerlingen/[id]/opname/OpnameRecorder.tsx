"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import AiUitwerkenKnop from "@/components/AiUitwerkenKnop";
import { OPNAME_STORAGE_KEY } from "../verslag/nieuw/VerslagWizard";
import {
  bewaarOpname,
  verwijderOpname,
  haalOpnamesVoorLeerling,
  type BewaardeOpname,
} from "@/lib/opnameStore";
import {
  haalUploadDoel,
  uploadNaarOpslag,
  withRetry,
  FALLBACK_MAX_BYTES,
  type UploadResultaat,
} from "@/lib/opnameUpload";

// idle → opnemen → verwerken (upload + AssemblyAI-transcriptie) → klaar / fout
type Fase = "idle" | "opnemen" | "verwerken" | "klaar" | "fout";

interface Utterance {
  speaker: string;
  text: string;
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 160; // ~6-7 minuten bovengrens

function formatTijd(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nieuwId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  return (
    c?.randomUUID?.() ??
    `op_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

function isAbort(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === "AbortError";
}

// Test-seam: laat tests een korte opname kunstmatig "verlengen" tot een groot
// bestand (30–60 min gesprek) zonder echt zo lang op te nemen.
function testPad(blob: Blob): Blob {
  const extra = (window as unknown as { __OPNAME_EXTRA_BYTES__?: number })
    .__OPNAME_EXTRA_BYTES__;
  if (typeof extra === "number" && extra > 0) {
    return new Blob([blob, new Uint8Array(extra)], {
      type: blob.type || "audio/webm",
    });
  }
  return blob;
}

// Bouwt een leesbaar transcript met sprekerslabels uit de utterances.
function bouwTranscript(
  utterances: Utterance[],
  labels: Record<string, string>
): string {
  return utterances
    .map((u) => `${labels[u.speaker] ?? `Spreker ${u.speaker}`}: ${u.text}`)
    .join("\n\n");
}

export default function OpnameRecorder({
  leerlingId,
  leerlingNaam,
}: {
  leerlingId: string;
  leerlingNaam: string;
}) {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("idle");

  // Definitief (AssemblyAI) transcript — dit gaat naar het verslag / de AI.
  const [transcript, setTranscript] = useState("");
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});

  // Optionele snelle voorvertoning tijdens het opnemen (Web Speech) — NIET
  // gebruikt voor het uiteindelijke verslag.
  const [preview, setPreview] = useState("");
  const [interim, setInterim] = useState("");

  const [seconden, setSeconden] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micFout, setMicFout] = useState<string | null>(null);
  const [verwerkStap, setVerwerkStap] = useState<"uploaden" | "transcriberen">(
    "uploaden"
  );
  const [uploadPct, setUploadPct] = useState(0);
  const [verwerkStatus, setVerwerkStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Onafgewerkte opnames die lokaal (IndexedDB) bewaard zijn — hervatbaar.
  const [bewaarde, setBewaarde] = useState<BewaardeOpname[]>([]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const opslagRef = useRef<{ mode: string; url: string | null }>({
    mode: "none",
    url: null,
  });
  const pollAbortRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // De blob + IndexedDB-id van de huidige opname (voor retry en opruimen).
  const huidigeBlobRef = useRef<Blob | null>(null);
  const opnameIdRef = useRef<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [mediaSupported, setMediaSupported] = useState(true);
  useEffect(() => {
    setMounted(true);
    setMediaSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof (window as any).MediaRecorder !== "undefined"
    );
    void ververBewaarde();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ververBewaarde() {
    try {
      const lijst = await haalOpnamesVoorLeerling(leerlingId);
      // De opname die nu net verwerkt wordt niet dubbel tonen.
      setBewaarde(lijst.filter((o) => o.id !== opnameIdRef.current));
    } catch {
      /* IndexedDB niet beschikbaar — negeren */
    }
  }

  const speech = useSpeechRecognition({
    onFinal: (t) => setPreview((h) => (h ? `${h} ${t}` : t)),
    onInterim: setInterim,
  });

  // Opnametimer
  useEffect(() => {
    if (fase === "opnemen") {
      timerRef.current = setInterval(() => setSeconden((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fase]);

  // Waarschuwing bij wegklikken/navigeren terwijl er nog geüpload/getranscribeerd
  // wordt — zodat een gevoelig oudergesprek niet ongemerkt verloren gaat.
  useEffect(() => {
    if (fase !== "opnemen" && fase !== "verwerken") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [fase]);

  // Opruimen bij unmount.
  useEffect(() => {
    return () => {
      pollAbortRef.current = true;
      abortRef.current?.abort();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setMicFout(null);
    setError(null);
    setSeconden(0);
    setPreview("");
    setInterim("");
    setTranscript("");
    setUtterances([]);
    setLabels({});
    pollAbortRef.current = true; // stop een eventuele vorige poll
    abortRef.current?.abort();
    opnameIdRef.current = null;
    huidigeBlobRef.current = null;
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : undefined;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const rauw = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type || "audio/webm",
        });
        const blob = testPad(rauw);
        setAudioUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        // Start de nauwkeurige transcriptie via AssemblyAI.
        void verwerkAudio(blob);
      };
      recorderRef.current = rec;
      rec.start();

      // Snelle voorvertoning (optioneel) tijdens het opnemen.
      speech.start();
      setFase("opnemen");
    } catch (err) {
      setMicFout(
        `Kon de microfoon niet starten: ${
          (err as Error).message || "geen toegang"
        }`
      );
    }
  }

  function stop() {
    speech.stop();
    setInterim("");
    recorderRef.current?.stop(); // triggert onstop -> verwerkAudio
  }

  // Meldt een nieuwe poging in de statustekst (retry met backoff).
  function meldRetry(poging: number, maxPogingen: number) {
    setVerwerkStatus(
      `Verbinding hapert — nieuwe poging ${poging}/${maxPogingen}…`
    );
  }

  // Voert de directe upload uit (met retry + chunking) en geeft de opslag-URL
  // terug. Behoudt de test-hook voor gesimuleerde uploads.
  async function doeUpload(
    blob: Blob,
    signal: AbortSignal
  ): Promise<UploadResultaat> {
    const override = (window as any).__OPNAME_UPLOAD_OVERRIDE__;
    if (typeof override === "function") {
      return override(blob, (pct: number) => setUploadPct(pct));
    }

    const doel = await withRetry(() => haalUploadDoel(signal), {
      signal,
      onRetry: meldRetry,
    });
    return uploadNaarOpslag(blob, doel, {
      signal,
      onProgress: (pct) => setUploadPct(pct),
      onRetry: meldRetry,
    });
  }

  // Uploadt het audiofragment (rechtstreeks, met retry + chunking) en pollt
  // AssemblyAI tot het transcript klaar is.
  async function verwerkAudio(blob: Blob) {
    huidigeBlobRef.current = blob;

    // Bewaar de opname lokaal (IndexedDB) tot upload + transcriptie bevestigd
    // zijn, zodat ze niet verloren gaat bij een fout of wegnavigeren.
    if (!opnameIdRef.current) {
      opnameIdRef.current = nieuwId();
      try {
        await bewaarOpname({
          id: opnameIdRef.current,
          leerlingId,
          leerlingNaam,
          createdAt: Date.now(),
          seconden,
          mime: blob.type || "audio/webm",
          blob,
        });
      } catch {
        /* IndexedDB niet beschikbaar — ga toch verder met de upload */
      }
    }

    pollAbortRef.current = false;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const signal = controller.signal;

    setFase("verwerken");
    setError(null);
    setVerwerkStap("uploaden");
    setUploadPct(0);
    setVerwerkStatus("Audio uploaden…");

    try {
      let opslag: UploadResultaat;
      try {
        opslag = await doeUpload(blob, signal);
      } catch (uploadErr) {
        if (pollAbortRef.current || isAbort(uploadErr)) return;
        // Fallback voor kleinere opnames: als de directe upload structureel
        // faalt (bv. Blob-dienst 503), verwerk dan via onze eigen route (server
        // uploadt zelf naar AssemblyAI, binnen de ~4,5MB-limiet). Zo raakt een
        // kort gesprek toch verwerkt i.p.v. te blijven hangen.
        if (blob.size <= FALLBACK_MAX_BYTES) {
          setVerwerkStatus(
            "Directe upload lukt niet — we verwerken de opname via de server…"
          );
          setUploadPct(100);
          opslag = { mode: "none", url: null };
        } else {
          throw uploadErr;
        }
      }
      opslagRef.current = opslag;

      let id: string;
      if (opslag.url) {
        // Directe upload gelukt: start de transcriptie op die URL (kleine JSON).
        setUploadPct(100);
        const startRes = await fetch("/api/opname/transcript", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ audioUrl: opslag.url }),
          signal,
        });
        const startData = await startRes.json().catch(() => ({}));
        if (!startRes.ok || !startData?.ok) {
          throw new Error(startData?.message || `Fout ${startRes.status}`);
        }
        id = startData.id;
      } else {
        // Fallback (geen directe opslag): ruwe audio via onze route.
        const startRes = await fetch("/api/opname/transcript", {
          method: "POST",
          headers: { "content-type": blob.type || "audio/webm" },
          body: blob,
          signal,
        });
        const startData = await startRes.json().catch(() => ({}));
        if (!startRes.ok || !startData?.ok) {
          throw new Error(startData?.message || `Fout ${startRes.status}`);
        }
        id = startData.id;
      }

      const begin = Date.now();
      setVerwerkStap("transcriberen");
      setVerwerkStatus("Transcriberen bij AssemblyAI…");

      for (let i = 0; i < MAX_POLLS; i++) {
        await sleep(POLL_INTERVAL_MS);
        if (pollAbortRef.current || signal.aborted) return;

        const r = await fetch(`/api/opname/transcript/${id}`, { signal });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d?.ok === false) {
          throw new Error(d?.message || `Fout ${r.status}`);
        }

        const secs = Math.round((Date.now() - begin) / 1000);
        if (d.done) {
          verwijderTijdelijkeAudio(); // privacy: audio niet bewaren
          await bevestigKlaar(); // lokale kopie mag nu weg
          toonResultaat(d.utterances ?? [], d.text ?? "");
          return;
        }
        const statusLabel = d.status === "queued" ? "in wachtrij" : "bezig";
        setVerwerkStatus(
          `Transcriberen bij AssemblyAI (${statusLabel})… ${secs}s`
        );
      }
      throw new Error("Time-out: de transcriptie duurde te lang.");
    } catch (e) {
      if (pollAbortRef.current || isAbort(e)) return;
      setError((e as Error).message);
      setFase("fout");
    }
  }

  // Verwijdert (best-effort) het tijdelijk geüploade audiofragment uit de opslag.
  function verwijderTijdelijkeAudio() {
    const { mode, url } = opslagRef.current;
    if (!url || mode === "none") return;
    void fetch("/api/opname/cleanup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, mode }),
    }).catch(() => {});
    opslagRef.current = { mode: "none", url: null };
  }

  // Transcriptie bevestigd → lokale (IndexedDB) kopie mag verwijderd worden.
  async function bevestigKlaar() {
    const id = opnameIdRef.current;
    opnameIdRef.current = null;
    huidigeBlobRef.current = null;
    if (id) {
      try {
        await verwijderOpname(id);
      } catch {
        /* negeren */
      }
    }
    void ververBewaarde();
  }

  // Retry na een fout: gebruik de bewaarde blob en probeer opnieuw. De opname
  // is dankzij IndexedDB niet verloren gegaan.
  function opnieuwProberen() {
    const blob = huidigeBlobRef.current;
    if (!blob) return;
    void verwerkAudio(blob);
  }

  // Hervat een lokaal bewaarde (onafgewerkte) opname.
  async function hervat(op: BewaardeOpname) {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(op.blob));
    setSeconden(op.seconden);
    setTranscript("");
    setUtterances([]);
    setLabels({});
    opnameIdRef.current = op.id;
    huidigeBlobRef.current = op.blob;
    setBewaarde((lijst) => lijst.filter((o) => o.id !== op.id));
    await verwerkAudio(op.blob);
  }

  async function verwijderBewaard(op: BewaardeOpname) {
    try {
      await verwijderOpname(op.id);
    } catch {
      /* negeren */
    }
    void ververBewaarde();
  }

  function toonResultaat(u: Utterance[], volledigeTekst: string) {
    if (u.length > 0) {
      const sprekers = [...new Set(u.map((x) => x.speaker))];
      const startLabels: Record<string, string> = {};
      for (const s of sprekers) startLabels[s] = `Spreker ${s}`;
      setUtterances(u);
      setLabels(startLabels);
      setTranscript(bouwTranscript(u, startLabels));
    } else {
      // Geen sprekersinfo — gebruik de platte tekst.
      setUtterances([]);
      setLabels({});
      setTranscript(volledigeTekst);
    }
    setFase("klaar");
  }

  // Hernoemt een spreker (bv. "Spreker A" → "Ouder") en past de labels toe op
  // de bestaande transcripttekst, zodat handmatige aanpassingen behouden blijven.
  function hernoemSpreker(speaker: string, nieuwLabel: string) {
    const oud = labels[speaker] ?? `Spreker ${speaker}`;
    const nieuw = nieuwLabel.trim();
    if (!nieuw || nieuw === oud) return;
    setLabels((prev) => ({ ...prev, [speaker]: nieuw }));
    setTranscript((tekst) =>
      tekst.replace(new RegExp(`^${escapeRegExp(oud)}:`, "gm"), `${nieuw}:`)
    );
  }

  function downloadAudio() {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    const datum = new Date().toISOString().slice(0, 10);
    a.download = `oudergesprek-${leerlingNaam.replace(/\s+/g, "-")}-${datum}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function maakVerslag() {
    try {
      sessionStorage.setItem(OPNAME_STORAGE_KEY(leerlingId), transcript);
    } catch {
      /* negeren */
    }
    router.push(`/leerlingen/${leerlingId}/verslag/nieuw`);
  }

  if (mounted && !mediaSupported) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        🎙️ Opnemen wordt niet ondersteund in deze browser. Gebruik Chrome.
      </div>
    );
  }

  const verwerkt = fase === "verwerken";

  return (
    <div className="space-y-5">
      {/* Onafgewerkte, lokaal bewaarde opnames — hervatbaar */}
      {fase !== "opnemen" && fase !== "verwerken" && bewaarde.length > 0 && (
        <div
          data-testid="bewaarde-opnames"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5"
        >
          <h2 className="text-sm font-semibold text-amber-800">
            💾 Onafgewerkte opname{bewaarde.length > 1 ? "s" : ""} gevonden
          </h2>
          <p className="mt-1 text-xs text-amber-700">
            Deze opname{bewaarde.length > 1 ? "s zijn" : " is"} lokaal bewaard
            gebleven (upload of transcriptie was nog niet afgerond). Je kan{" "}
            {bewaarde.length > 1 ? "ze" : "ze"} hervatten.
          </p>
          <ul className="mt-3 space-y-2">
            {bewaarde.map((op) => (
              <li
                key={op.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2"
              >
                <span className="text-sm text-slate-700">
                  Opname van {formatTijd(op.seconden)} —{" "}
                  {new Date(op.createdAt).toLocaleString("nl-BE")}
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => hervat(op)}
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    ▶️ Hervatten
                  </button>
                  <button
                    onClick={() => verwijderBewaard(op)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Verwijderen
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Opnamepaneel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-4">
          {fase !== "opnemen" ? (
            <button
              onClick={start}
              disabled={verwerkt}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <span aria-hidden>●</span>{" "}
              {fase === "idle" ? "Opname starten" : "Opnieuw opnemen"}
            </button>
          ) : (
            <button
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
            >
              <span aria-hidden>⏹️</span> Opname stoppen
            </button>
          )}

          {fase === "opnemen" && (
            <span className="flex items-center gap-2 text-sm font-medium text-red-600">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-red-600" />
              Aan het opnemen — {formatTijd(seconden)}
            </span>
          )}
          {(fase === "klaar" || fase === "fout") && seconden > 0 && (
            <span className="text-sm text-slate-500">
              Opname van {formatTijd(seconden)}.
            </span>
          )}
        </div>

        {micFout && (
          <p className="mt-3 text-sm font-medium text-red-600">⚠️ {micFout}</p>
        )}

        {/* Snelle voorvertoning tijdens het opnemen (niet definitief) */}
        {fase === "opnemen" && (
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Snelle voorvertoning {speech.supported ? "" : "(niet beschikbaar in deze browser)"}
            </div>
            {speech.supported ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">
                {preview}
                {interim && <span className="italic text-slate-400"> {interim}</span>}
                {!preview && !interim && (
                  <span className="text-slate-400">Luisteren…</span>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">
                De nauwkeurige transcriptie gebeurt na het stoppen via AssemblyAI.
              </p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Dit is enkel een ruwe preview. Het definitieve transcript wordt na
              het stoppen nauwkeurig opgesteld met AssemblyAI (incl. sprekers).
            </p>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-400">
          🔒 Privacy: het audiofragment wordt <strong>rechtstreeks</strong> naar
          tijdelijke opslag geüpload en enkel voor de transcriptie naar
          AssemblyAI gestuurd; het wordt daarna verwijderd en <strong>niet</strong>{" "}
          in onze database bewaard. Tot de upload én transcriptie bevestigd zijn,
          blijft de opname veilig lokaal (in je browser) bewaard. Je kan het
          audiofragment hieronder ook zelf lokaal downloaden.
        </p>
      </div>

      {/* Verwerkingsstatus */}
      {verwerkt && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
          {verwerkStap === "uploaden" ? (
            <>
              <div className="mb-2 flex items-center justify-between text-sm font-medium text-brand-800">
                <span>📤 Audiofragment uploaden…</span>
                <span data-testid="upload-pct">{uploadPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-full rounded-full bg-brand-600 transition-[width] duration-200"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-brand-700" data-testid="verwerk-status">
                {verwerkStatus ||
                  "De volledige opname wordt geüpload — ook lange gesprekken en meetings van 30–60+ minuten."}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                <span className="text-sm font-medium text-brand-800">
                  {verwerkStatus || "Bezig…"}
                </span>
              </div>
              <p className="mt-2 text-xs text-brand-700">
                Transcriberen kan bij langere opnames enkele tientallen seconden
                tot enkele minuten duren. De status wordt automatisch bijgewerkt.
              </p>
            </>
          )}
        </div>
      )}

      {/* Fout bij upload/transcriptie */}
      {fase === "fout" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm">
          <p className="font-medium text-red-700">
            ⚠️ Verwerking mislukt: {error}
          </p>
          <p className="mt-1 text-red-600">
            Je opname is <strong>niet verloren</strong> — ze is lokaal bewaard.
            Probeer opnieuw, download het audiofragment, of typ het transcript
            hieronder handmatig.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {huidigeBlobRef.current && (
              <button
                onClick={opnieuwProberen}
                data-testid="retry-knop"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                🔄 Upload opnieuw proberen
              </button>
            )}
            {audioUrl && (
              <button
                onClick={downloadAudio}
                className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                ⬇️ Audiofragment downloaden
              </button>
            )}
          </div>
        </div>
      )}

      {/* Transcript (na AssemblyAI, of handmatig bij fout) */}
      {(fase === "klaar" || fase === "fout") && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-800">
              Transcript{" "}
              {fase === "klaar" && (
                <span className="text-sm font-normal text-slate-400">
                  (AssemblyAI)
                </span>
              )}
            </h2>
            <AiUitwerkenKnop tekst={transcript} onVervang={setTranscript} compact />
          </div>

          {/* Sprekers hernoemen */}
          {Object.keys(labels).length > 0 && (
            <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-medium text-slate-500">
                Sprekers hernoemen (bv. “Ouder”, “Leerkracht”)
              </div>
              <div className="flex flex-wrap gap-3">
                {Object.keys(labels).map((speaker) => (
                  <div key={speaker} className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Spreker {speaker}:</span>
                    <input
                      type="text"
                      defaultValue={labels[speaker]}
                      onBlur={(e) => hernoemSpreker(speaker, e.target.value)}
                      className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Tip: hernoem de sprekers vóór je de tekst handmatig aanpast.
              </p>
            </div>
          )}

          <textarea
            rows={12}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Het transcript verschijnt hier na de verwerking. Je kan het vrij corrigeren en aanvullen."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={maakVerslag}
              disabled={!transcript.trim()}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              📝 Verslag maken van dit gesprek
            </button>
            {audioUrl && (
              <button
                onClick={downloadAudio}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ⬇️ Audiofragment downloaden (webm)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
