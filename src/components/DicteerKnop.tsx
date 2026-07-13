"use client";

import { useEffect, useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

// Microfoon-knop die live spraak naar tekst omzet (Web Speech API, Nederlands).
// Roept onTekst aan met elk afgerond stuk herkende tekst, zodat de gebruiker
// het aan een tekstveld kan toevoegen.
export default function DicteerKnop({
  onTekst,
  compact = false,
}: {
  onTekst: (tekst: string) => void;
  compact?: boolean;
}) {
  const [interim, setInterim] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { supported, listening, error, start, stop } = useSpeechRecognition({
    onFinal: (t) => {
      onTekst(t);
      setInterim("");
    },
    onInterim: setInterim,
  });

  // Voor de mount weten we de browserondersteuning nog niet — toon niets,
  // zodat er geen "niet ondersteund"-melding flitst.
  if (!mounted) return null;

  if (!supported) {
    return (
      <p className="text-xs text-slate-500">
        🎤 Dicteren wordt niet ondersteund in deze browser, gebruik Chrome.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={listening ? stop : start}
          aria-pressed={listening}
          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            listening
              ? "animate-pulse bg-red-600 text-white hover:bg-red-700"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span aria-hidden>{listening ? "⏹️" : "🎤"}</span>
          {listening ? "Stop dicteren" : compact ? "Dicteren" : "Dicteren (spraak → tekst)"}
        </button>
        {listening && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-600">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600" />
            Aan het luisteren…
          </span>
        )}
      </div>
      {interim && (
        <p className="text-xs italic text-slate-400">hoorde: {interim}</p>
      )}
      {error && <p className="text-xs font-medium text-red-600">⚠️ {error}</p>}
    </div>
  );
}
