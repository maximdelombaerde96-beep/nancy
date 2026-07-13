"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import AiUitwerkenKnop from "@/components/AiUitwerkenKnop";
import { OPNAME_STORAGE_KEY } from "../verslag/nieuw/VerslagWizard";

type Fase = "idle" | "opnemen" | "gestopt";

function formatTijd(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
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
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [seconden, setSeconden] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micFout, setMicFout] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    onFinal: (t) => setTranscript((h) => (h ? `${h} ${t}` : t)),
    onInterim: setInterim,
  });

  // Timer
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
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setMicFout(null);
    setSeconden(0);
    setTranscript("");
    setInterim("");
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
      };
      recorderRef.current = rec;
      rec.start();

      // Live transcript (Web Speech) parallel aan de opname.
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
    recorderRef.current?.stop();
    speech.stop();
    setInterim("");
    setFase("gestopt");
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

  return (
    <div className="space-y-5">
      {/* Opnamepaneel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-4">
          {fase !== "opnemen" ? (
            <button
              onClick={start}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <span aria-hidden>●</span>{" "}
              {fase === "gestopt" ? "Opnieuw opnemen" : "Opname starten"}
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
          {fase === "gestopt" && (
            <span className="text-sm text-slate-500">
              Opname van {formatTijd(seconden)} klaar.
            </span>
          )}
        </div>

        {micFout && (
          <p className="mt-3 text-sm font-medium text-red-600">⚠️ {micFout}</p>
        )}

        {mounted && !speech.supported && (
          <p className="mt-3 text-sm text-amber-700">
            ⚠️ Live transcriptie wordt niet ondersteund in deze browser (gebruik
            Chrome). Je kan wel opnemen en het transcript hieronder zelf typen.
          </p>
        )}
        {speech.error && (
          <p className="mt-3 text-sm font-medium text-red-600">
            ⚠️ {speech.error}
          </p>
        )}

        <p className="mt-3 text-xs text-slate-400">
          🔒 Privacy: enkel het transcript (tekst) wordt bij de leerling bewaard.
          Het audiofragment gaat nooit naar de server — je kan het hieronder wél
          zelf lokaal downloaden.
        </p>
      </div>

      {/* Transcript */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Transcript</h2>
          <div className="flex flex-wrap items-center gap-2">
            {interim && (
              <span className="text-xs italic text-slate-400">
                hoorde: {interim}
              </span>
            )}
            <AiUitwerkenKnop tekst={transcript} onVervang={setTranscript} compact />
          </div>
        </div>
        <textarea
          rows={10}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Het live transcript verschijnt hier terwijl je opneemt. Na het stoppen kan je het vrij corrigeren en aanvullen."
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
    </div>
  );
}
