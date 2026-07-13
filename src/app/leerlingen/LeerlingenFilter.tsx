"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { zorgStatusOpties } from "@/lib/format";

interface Props {
  klassen: { id: string; naam: string }[];
  leerjaren: number[];
}

export default function LeerlingenFilter({ klassen, leerjaren }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`/leerlingen?${next.toString()}`);
    },
    [params, router]
  );

  const q = params.get("q") ?? "";
  const klas = params.get("klas") ?? "";
  const leerjaar = params.get("leerjaar") ?? "";
  const status = params.get("status") ?? "";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="lg:col-span-1">
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Zoeken
        </label>
        <input
          type="text"
          defaultValue={q}
          placeholder="Naam..."
          onChange={(e) => update("q", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Klas</label>
        <select
          value={klas}
          onChange={(e) => update("klas", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Alle klassen</option>
          {klassen.map((k) => (
            <option key={k.id} value={k.id}>
              {k.naam}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Leerjaar
        </label>
        <select
          value={leerjaar}
          onChange={(e) => update("leerjaar", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Alle leerjaren</option>
          {leerjaren.map((lj) => (
            <option key={lj} value={lj}>
              Leerjaar {lj}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Zorgstatus
        </label>
        <select
          value={status}
          onChange={(e) => update("status", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Alle statussen</option>
          {zorgStatusOpties.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
