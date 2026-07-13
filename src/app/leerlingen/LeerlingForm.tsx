"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  maakLeerling,
  updateLeerling,
  type LeerlingFormState,
} from "./actions";
import { zorgStatusOpties } from "@/lib/format";

interface LeerlingData {
  id: string;
  voornaam: string;
  achternaam: string;
  geboortedatum: string; // YYYY-MM-DD
  klasId: string | null;
  leerjaar: number;
  schooljaar: string;
  status: string;
}

interface Props {
  klassen: { id: string; naam: string; leerjaar: number; schooljaar: string }[];
  leerling?: LeerlingData; // aanwezig => bewerken, afwezig => nieuw
}

export default function LeerlingForm({ klassen, leerling }: Props) {
  const isEdit = Boolean(leerling);
  const action = isEdit ? updateLeerling : maakLeerling;
  const [state, formAction, pending] = useActionState<
    LeerlingFormState | null,
    FormData
  >(action, null);

  const standaardSchooljaar =
    leerling?.schooljaar ?? klassen[0]?.schooljaar ?? "2025-2026";

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      {isEdit && <input type="hidden" name="id" value={leerling!.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Voornaam *
          </label>
          <input
            type="text"
            name="voornaam"
            required
            defaultValue={leerling?.voornaam ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Achternaam *
          </label>
          <input
            type="text"
            name="achternaam"
            required
            defaultValue={leerling?.achternaam ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Geboortedatum *
          </label>
          <input
            type="date"
            name="geboortedatum"
            required
            defaultValue={leerling?.geboortedatum ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Klas
          </label>
          <select
            name="klasId"
            defaultValue={leerling?.klasId ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— Geen klas —</option>
            {klassen.map((k) => (
              <option key={k.id} value={k.id}>
                {k.naam} (leerjaar {k.leerjaar})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Leerjaar *
          </label>
          <input
            type="number"
            name="leerjaar"
            required
            min={1}
            max={6}
            defaultValue={leerling?.leerjaar ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Schooljaar *
          </label>
          <input
            type="text"
            name="schooljaar"
            required
            placeholder="2025-2026"
            defaultValue={standaardSchooljaar}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Zorgstatus
          </label>
          <select
            name="status"
            defaultValue={leerling?.status ?? "geen"}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-72"
          >
            {zorgStatusOpties.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state?.error && (
        <p className="text-sm font-medium text-red-600">⚠️ {state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending
            ? "Bezig..."
            : isEdit
              ? "Wijzigingen opslaan"
              : "Leerling aanmaken"}
        </button>
        <Link
          href={isEdit ? `/leerlingen/${leerling!.id}` : "/leerlingen"}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Annuleren
        </Link>
      </div>
    </form>
  );
}
