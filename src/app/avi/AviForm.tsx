"use client";

import { useActionState, useEffect, useRef } from "react";
import { registreerAvi, type AviActionResult } from "./actions";

interface Props {
  leerlingen: {
    id: string;
    voornaam: string;
    achternaam: string;
    leerjaar: number;
    klasNaam: string;
  }[];
  preselect?: string;
}

export default function AviForm({ leerlingen, preselect }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    AviActionResult | null,
    FormData
  >(registreerAvi, null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const vandaag = new Date().toISOString().slice(0, 10);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      <h2 className="text-lg font-semibold text-slate-800">
        AVI-resultaat invoeren
      </h2>
      <p className="text-sm text-slate-500">
        Vul enkel de <strong>leestijd</strong> en het <strong>aantal fouten</strong>{" "}
        in. Het systeem berekent automatisch het AVI-niveau en de status op basis
        van de normtabel.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Leerling
          </label>
          <select
            name="leerlingId"
            required
            defaultValue={preselect ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Kies een leerling...
            </option>
            {leerlingen.map((l) => (
              <option key={l.id} value={l.id}>
                {l.achternaam}, {l.voornaam} ({l.klasNaam})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Toetsmoment
          </label>
          <input
            type="text"
            name="toetsmoment"
            required
            placeholder="bv. M3, E3, M4"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-400">
            M = midden schooljaar, E = eind. Cijfer = leerjaar.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Datum
          </label>
          <input
            type="date"
            name="datum"
            defaultValue={vandaag}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Leestijd (sec)
            </label>
            <input
              type="number"
              name="leestijd"
              required
              min={0}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Fouten
            </label>
            <input
              type="number"
              name="fouten"
              required
              min={0}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Berekenen..." : "Berekenen & opslaan"}
        </button>
        {state && (
          <span
            className={`text-sm font-medium ${
              state.ok ? "text-green-600" : "text-red-600"
            }`}
          >
            {state.ok ? "✅ " : "⚠️ "}
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
