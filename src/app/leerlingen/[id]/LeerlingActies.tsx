"use client";

import Link from "next/link";
import { zetArchief, verwijderLeerling } from "../actions";

export default function LeerlingActies({
  id,
  gearchiveerd,
  naam,
}: {
  id: string;
  gearchiveerd: boolean;
  naam: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/leerlingen/${id}/bewerken`}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        ✏️ Bewerken
      </Link>

      <Link
        href={`/leerlingen/${id}/print`}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        🖨️ Print / PDF
      </Link>

      <form action={zetArchief}>
        <input type="hidden" name="id" value={id} />
        <input
          type="hidden"
          name="gearchiveerd"
          value={gearchiveerd ? "false" : "true"}
        />
        <button
          type="submit"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {gearchiveerd ? "♻️ Herstellen" : "📦 Archiveren"}
        </button>
      </form>

      <form
        action={verwijderLeerling}
        onSubmit={(e) => {
          if (
            !confirm(
              `Leerling "${naam}" definitief verwijderen? Dit verwijdert ook het volledige dossier (zorgprofiel, AVI, acties, verslagen) en kan niet ongedaan gemaakt worden.`
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          🗑️ Verwijderen
        </button>
      </form>
    </div>
  );
}
