"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
//  Herbruikbare hook rond de browser-native Web Speech API (SpeechRecognition).
//  Gratis, geen externe API. Werkt in Chrome/Edge; niet in Safari/Firefox.
//  Taal: probeert nl-BE, valt terug op nl-NL.
// ============================================================================

interface Options {
  // Wordt aangeroepen met elk afgerond (definitief) stuk herkende tekst.
  onFinal?: (tekst: string) => void;
  // Wordt aangeroepen met de voorlopige (nog niet afgeronde) tekst.
  onInterim?: (tekst: string) => void;
}

export interface SpeechRecognitionApi {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
}

const TALEN = ["nl-BE", "nl-NL"];

function mapFout(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Geen toegang tot de microfoon. Geef toestemming in je browser.";
    case "audio-capture":
      return "Geen microfoon gevonden.";
    case "no-speech":
    case "aborted":
    case "language-not-supported":
      return null; // niet-fataal, wordt intern afgehandeld
    default:
      return `Spraakherkenning-fout: ${code}`;
  }
}

export function useSpeechRecognition(opts: Options = {}): SpeechRecognitionApi {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recogRef = useRef<any>(null);
  const wantListenRef = useRef(false);
  const langIdxRef = useRef(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const SR =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition)) ||
      null;
    setSupported(Boolean(SR));
  }, []);

  // Maakt een nieuwe recognition-instantie aan en start ze. Wordt bij elke
  // (auto)herstart opnieuw aangeroepen, zodat een gewijzigde taalkeuze meteen
  // wordt opgepikt.
  const spawnRef = useRef<() => void>(() => {});
  spawnRef.current = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = TALEN[langIdxRef.current] ?? "nl-NL";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const t = (res[0]?.transcript ?? "").trim();
          if (t) optsRef.current.onFinal?.(t);
        } else {
          interim += res[0]?.transcript ?? "";
        }
      }
      optsRef.current.onInterim?.(interim.trim());
    };

    r.onerror = (e: any) => {
      const code = e?.error ?? "unknown";
      if (code === "language-not-supported" && langIdxRef.current < TALEN.length - 1) {
        langIdxRef.current += 1; // volgende taal proberen bij de herstart
        return;
      }
      const msg = mapFout(code);
      if (msg) {
        wantListenRef.current = false;
        setError(msg);
        setListening(false);
      }
    };

    r.onend = () => {
      // Continu blijven luisteren: herstart zolang de gebruiker dat wil.
      if (wantListenRef.current) {
        spawnRef.current();
      } else {
        setListening(false);
      }
    };

    recogRef.current = r;
    try {
      r.start();
    } catch {
      /* start kan gooien als er al een actieve sessie is; genegeerd */
    }
  };

  const start = useCallback(() => {
    if (!supported || wantListenRef.current) return;
    setError(null);
    langIdxRef.current = 0;
    wantListenRef.current = true;
    setListening(true);
    spawnRef.current();
  }, [supported]);

  const stop = useCallback(() => {
    wantListenRef.current = false;
    try {
      recogRef.current?.stop();
    } catch {
      /* genegeerd */
    }
    setListening(false);
  }, []);

  // Opruimen bij unmount.
  useEffect(() => {
    return () => {
      wantListenRef.current = false;
      try {
        recogRef.current?.stop();
      } catch {
        /* genegeerd */
      }
    };
  }, []);

  return { supported, listening, error, start, stop };
}
