"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Props {
  leerlingen: { id: string; naam: string }[];
}

export default function OpvolgingFilters({ leerlingen }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`/opvolging?${next.toString()}`);
    },
    [params, router]
  );

  const get = (k: string) => params.get(k) ?? "";
  const selectCls =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Status
        </label>
        <select
          value={get("status") || "open"}
          onChange={(e) => update("status", e.target.value)}
          className={selectCls}
        >
          <option value="open">Open</option>
          <option value="afgerond">Afgerond</option>
          <option value="alle">Alle</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Vervaldatum
        </label>
        <select
          value={get("urgentie")}
          onChange={(e) => update("urgentie", e.target.value)}
          className={selectCls}
        >
          <option value="">Alle</option>
          <option value="verlopen">Verlopen</option>
          <option value="binnenkort">Binnenkort (≤ 14 dagen)</option>
          <option value="later">Later</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Leerling
        </label>
        <select
          value={get("leerling")}
          onChange={(e) => update("leerling", e.target.value)}
          className={selectCls}
        >
          <option value="">Alle leerlingen</option>
          {leerlingen.map((l) => (
            <option key={l.id} value={l.id}>
              {l.naam}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
