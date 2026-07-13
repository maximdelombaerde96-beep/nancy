"use client";

import { useRef, useState } from "react";
import { voegActieToe } from "../actions";

export default function ActieForm({ leerlingId }: { leerlingId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        setPending(true);
        await voegActieToe(fd);
        formRef.current?.reset();
        setPending(false);
      }}
      className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <input type="hidden" name="leerlingId" value={leerlingId} />
      <div className="flex flex-wrap gap-3">
        <select
          name="type"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          defaultValue="actie"
        >
          <option value="actie">Actie</option>
          <option value="notitie">Notitie</option>
        </select>
        <input
          type="text"
          name="auteur"
          placeholder="Auteur (bv. jouw naam)"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Opvolgdatum
          <input
            type="date"
            name="opvolgdatum"
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          />
        </label>
      </div>
      <textarea
        name="tekst"
        required
        rows={2}
        placeholder="Beschrijf de actie of notitie..."
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Bezig..." : "Toevoegen"}
      </button>
    </form>
  );
}
