"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import AiUitwerkenKnop from "@/components/AiUitwerkenKnop";
import { OPNAME_STORAGE_KEY } from "../verslag/nieuw/VerslagWizard";

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
  const [verwerkStatus, setVerwerkStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAbortRef = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [mediaSupported, setMediaSupported] = useState(true);
  useEffect(() => {
    setMounted(true);
    setMediaSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof (window as any).MediaRecorder !== "undefined"
    );
  }, []);

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

  // Opruimen bij unmount.
  useEffect(() => {
    return () => {
      pollAbortRef.current = true;
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
        const blob = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type || "audio/webm",
        });
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

  // Upload het audiofragment en pollt AssemblyAI tot het transcript klaar is.
  async function verwerkAudio(blob: Blob) {
    pollAbortRef.current = false;
    setFase("verwerken");
    setError(null);
    setVerwerkStatus("Audio uploaden…");

    try {
      const startRes = await fetch("/api/opname/transcript", {
        method: "POST",
        headers: { "content-type": blob.type || "audio/webm" },
        body: blob,
      });
      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok || !startData?.ok) {
        throw new Error(startData?.message || `Fout ${startRes.status}`);
      }
      const id: string = startData.id;

      const begin = Date.now();
      setVerwerkStatus("Transcriberen bij AssemblyAI…");

      for (let i = 0; i < MAX_POLLS; i++) {
        await sleep(POLL_INTERVAL_MS);
        if (pollAbortRef.current) return;

        const r = await fetch(`/api/opname/transcript/${id}`);
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d?.ok === false) {
          throw new Error(d?.message || `Fout ${r.status}`);
        }

        const secs = Math.round((Date.now() - begin) / 1000);
        if (d.done) {
          toonResultaat(d.utterances ?? [], d.text ?? "");
          return;
        }
        const statusLabel =
          d.status === "queued" ? "in wachtrij" : "bezig";
        setVerwerkStatus(
          `Transcriberen bij AssemblyAI (${statusLabel})… ${secs}s`
        );
      }
      throw new Error("Time-out: de transcriptie duurde te lang.");
    } catch (e) {
      if (pollAbortRef.current) return;
      setError((e as Error).message);
      setFase("fout");
    }
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
          🔒 Privacy: het audiofragment wordt tijdelijk naar AssemblyAI gestuurd
          voor de transcriptie en wordt <strong>niet</strong> in onze database
          bewaard. Enkel het teksttranscript wordt opgeslagen. Je kan het
          audiofragment hieronder wél zelf lokaal downloaden.
        </p>
      </div>

      {/* Verwerkingsstatus */}
      {verwerkt && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
          <div className="flex items-center gap-3">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm font-medium text-brand-800">
              {verwerkStatus || "Bezig…"}
            </span>
          </div>
          <p className="mt-2 text-xs text-brand-700">
            Transcriberen kan bij langere opnames enkele tientallen seconden tot
            enkele minuten duren. Je hoeft niet te wachten met dit tabblad open —
            de status wordt automatisch bijgewerkt.
          </p>
        </div>
      )}

      {/* Fout bij transcriptie */}
      {fase === "fout" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm">
          <p className="font-medium text-red-700">
            ⚠️ Transcriptie mislukt: {error}
          </p>
          <p className="mt-1 text-red-600">
            Je kan het <strong>opnieuw opnemen</strong>, het audiofragment
            downloaden, of het transcript hieronder handmatig typen.
          </p>
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
