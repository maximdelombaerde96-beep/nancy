"use client";

import Link from "next/link";
import { useState } from "react";

interface Resultaat {
  ok: boolean;
  message: string;
  leerlingen?: number;
  klassen?: number;
  normen?: number;
  verslagen?: number;
}

export default function SeedButton({ alGevuld }: { alGevuld: boolean }) {
  const [bezig, setBezig] = useState(false);
  const [res, setRes] = useState<Resultaat | null>(null);

  async function run() {
    if (
      !confirm(
        "Testdata in de database plaatsen? Dit gebeurt enkel als de database nog leeg is."
      )
    )
      return;
    setBezig(true);
    setRes(null);
    try {
      const r = await fetch("/api/admin/seed", { method: "POST" });
      setRes(await r.json());
    } catch (e) {
      setRes({ ok: false, message: `Netwerkfout: ${(e as Error).message}` });
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={run}
        disabled={bezig || alGevuld}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {bezig ? "Bezig met seeden..." : "Testdata plaatsen"}
      </button>

      {alGevuld && !res && (
        <p className="text-sm text-slate-500">
          De database bevat al leerlingen — seeden is uitgeschakeld om bestaande
          data niet te overschrijven.
        </p>
      )}

      {res && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            res.ok
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <p className="font-medium">
            {res.ok ? "✅ " : "⚠️ "}
            {res.message}
          </p>
          {res.ok && (
            <>
              <p className="mt-1 text-slate-600">
                {res.klassen} klassen · {res.leerlingen} leerlingen ·{" "}
                {res.normen} normtabel-rijen · {res.verslagen} verslag(en).
              </p>
              <Link
                href="/leerlingen"
                className="mt-2 inline-block font-medium text-brand-700 hover:underline"
              >
                → Naar de leerlingenlijst
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
