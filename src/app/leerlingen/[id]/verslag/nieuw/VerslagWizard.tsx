"use client";

import { useActionState, useEffect, useState } from "react";
import {
  genereerConcept,
  bewaarVerslag,
  type GenereerResult,
} from "../actions";
import DicteerKnop from "@/components/DicteerKnop";

// sessionStorage-sleutel waarmee een opgenomen gesprek (transcript) wordt
// doorgegeven aan dit formulier.
export const OPNAME_STORAGE_KEY = (leerlingId: string) =>
  `opname-transcript:${leerlingId}`;

interface Props {
  leerlingId: string;
  leerlingNaam: string;
  apiKeyAanwezig: boolean;
}

export default function VerslagWizard({
  leerlingId,
  leerlingNaam,
  apiKeyAanwezig,
}: Props) {
  const [state, formAction, pending] = useActionState<
    GenereerResult | null,
    FormData
  >(genereerConcept, null);

  const [brontekst, setBrontekst] = useState("");

  // Neem een eventueel opgenomen gesprek-transcript over als startpunt.
  useEffect(() => {
    try {
      const key = OPNAME_STORAGE_KEY(leerlingId);
      const opgenomen = sessionStorage.getItem(key);
      if (opgenomen) {
        setBrontekst(opgenomen);
        sessionStorage.removeItem(key);
      }
    } catch {
      /* sessionStorage niet beschikbaar — negeren */
    }
  }, [leerlingId]);

  // Voegt gedicteerde tekst netjes toe aan de bestaande notities.
  const voegDictaatToe = (t: string) =>
    setBrontekst((huidig) => (huidig ? `${huidig} ${t}` : t));

  const vandaag = new Date().toISOString().slice(0, 10);
  const concept = state?.ok ? state.data : undefined;

  return (
    <div className="space-y-6">
      {/* Stap 1: notities invoeren */}
      <form
        action={formAction}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <input type="hidden" name="leerlingId" value={leerlingId} />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            1. Losse notities
          </h2>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              apiKeyAanwezig
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {apiKeyAanwezig
              ? "Claude API actief"
              : "Mock-modus (geen API key ingevuld)"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Datum gesprek
            </label>
            <input
              type="date"
              name="datum"
              defaultValue={vandaag}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Aanwezigen
            </label>
            <input
              type="text"
              name="aanwezigen"
              placeholder="bv. ouders, klasleerkracht, zorgcoördinator"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-medium text-slate-500">
              Notities over het gesprek met/over {leerlingNaam}
            </label>
            <DicteerKnop onTekst={voegDictaatToe} compact />
          </div>
          <textarea
            name="brontekst"
            required
            rows={6}
            value={brontekst}
            onChange={(e) => setBrontekst(e.target.value)}
            placeholder="Typ hier je losse notities, of gebruik de dicteerknop. Bijvoorbeeld: ouders bezorgd over lezen, thuis weinig motivatie, afspraak dagelijks 10 min samen lezen, voorleessoftware helpt..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "Genereren..." : "🪄 Genereer verslag"}
          </button>
          {state && !state.ok && (
            <span className="text-sm font-medium text-red-600">
              ⚠️ {state.message}
            </span>
          )}
        </div>
      </form>

      {/* Stap 2: beoordelen & goedkeuren */}
      {concept && (
        <form
          action={bewaarVerslag}
          className="space-y-4 rounded-xl border-2 border-brand-200 bg-white p-5"
        >
          <input type="hidden" name="leerlingId" value={leerlingId} />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              2. Beoordeel &amp; keur goed
            </h2>
            <span className="text-xs text-slate-400">
              Gegenereerd door: {concept.bron === "claude" ? "Claude API" : "mock"}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Pas de tekst gerust aan waar nodig. Bij opslaan wordt het verslag
            bewaard bij de leerling.
          </p>

          {/* Verborgen velden zodat brontekst/aanwezigen/datum meegaan */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Datum
              </label>
              <input
                type="date"
                name="datum"
                defaultValue={state?.input?.datum || vandaag}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Aanwezigen
              </label>
              <input
                type="text"
                name="aanwezigen"
                defaultValue={state?.input?.aanwezigen || ""}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Verslag
            </label>
            <textarea
              name="gegenereerdVerslag"
              rows={8}
              defaultValue={concept.verslag}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Actiepunten
            </label>
            <textarea
              name="actiepunten"
              rows={4}
              defaultValue={concept.actiepunten}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="sm:w-64">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Voorgestelde opvolgdatum
            </label>
            <input
              type="date"
              name="opvolgdatum"
              defaultValue={concept.opvolgdatum}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {/* Brontekst bewaren we mee (verborgen) */}
          <textarea
            name="brontekst"
            defaultValue={state?.input?.brontekst || ""}
            className="hidden"
            readOnly
          />

          <button
            type="submit"
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            ✅ Goedkeuren &amp; opslaan
          </button>
        </form>
      )}
    </div>
  );
}
