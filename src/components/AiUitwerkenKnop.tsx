"use client";

import { useState } from "react";

// Knop "Laat AI uitwerken": stuurt de huidige tekst naar de server-side
// API-route en vervangt bij succes de tekst in het veld. De oorspronkelijke
// tekst blijft bewaard voor "Ongedaan maken", en gaat nooit verloren bij een fout.
export default function AiUitwerkenKnop({
  tekst,
  onVervang,
  compact = false,
}: {
  tekst: string;
  onVervang: (nieuweTekst: string) => void;
  compact?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origineel, setOrigineel] = useState<string | null>(null);

  async function uitwerken() {
    if (!tekst.trim()) {
      setError("Er is nog geen tekst om uit te werken.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/verslag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tekst }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.message || `Er ging iets mis (fout ${res.status}).`);
        return;
      }
      setOrigineel(tekst); // bewaar voor "ongedaan maken"
      onVervang(String(data.tekst ?? ""));
    } catch (e) {
      setError(`Netwerkfout: ${(e as Error).message}`);
    } finally {
      setPending(false);
    }
  }

  function ongedaanMaken() {
    if (origineel !== null) {
      onVervang(origineel);
      setOrigineel(null);
      setError(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={uitwerken}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
        >
          {pending ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
              AI werkt uit…
            </>
          ) : (
            <>
              <span aria-hidden>✨</span>
              {compact ? "Laat AI uitwerken" : "Laat AI uitwerken (spraak → net verslag)"}
            </>
          )}
        </button>

        {origineel !== null && !pending && (
          <button
            type="button"
            onClick={ongedaanMaken}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            ↩︎ Ongedaan maken
          </button>
        )}
      </div>

      {origineel !== null && !pending && !error && (
        <p className="text-xs text-green-600">
          ✅ Uitgewerkt door AI. Niet tevreden? Klik op “Ongedaan maken” om je
          oorspronkelijke tekst terug te zetten.
        </p>
      )}
      {error && <p className="text-xs font-medium text-red-600">⚠️ {error}</p>}
    </div>
  );
}
