"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { zorgStatusOpties } from "@/lib/format";

interface Props {
  klassen: { id: string; naam: string }[];
  leerjaren: number[];
  diagnoseTypes: string[];
}

export default function DashboardFilters({
  klassen,
  leerjaren,
  diagnoseTypes,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`/dashboard?${next.toString()}`);
    },
    [params, router]
  );

  const get = (k: string) => params.get(k) ?? "";

  const selectCls =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Klas">
        <select
          value={get("klas")}
          onChange={(e) => update("klas", e.target.value)}
          className={selectCls}
        >
          <option value="">Alle klassen</option>
          {klassen.map((k) => (
            <option key={k.id} value={k.id}>
              {k.naam}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Leerjaar">
        <select
          value={get("leerjaar")}
          onChange={(e) => update("leerjaar", e.target.value)}
          className={selectCls}
        >
          <option value="">Alle leerjaren</option>
          {leerjaren.map((lj) => (
            <option key={lj} value={lj}>
              Leerjaar {lj}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Zorgstatus">
        <select
          value={get("status")}
          onChange={(e) => update("status", e.target.value)}
          className={selectCls}
        >
          <option value="">Alle statussen</option>
          {zorgStatusOpties.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="AVI-status">
        <select
          value={get("avi")}
          onChange={(e) => update("avi", e.target.value)}
          className={selectCls}
        >
          <option value="">Alle AVI-statussen</option>
          <option value="onder">Onder niveau</option>
          <option value="op">Op niveau</option>
          <option value="boven">Boven niveau</option>
          <option value="geen">Nog geen toets</option>
        </select>
      </Field>

      <Field label="Logopedie">
        <select
          value={get("logo")}
          onChange={(e) => update("logo", e.target.value)}
          className={selectCls}
        >
          <option value="">Alle</option>
          <option value="ja">Met logopedie</option>
          <option value="nee">Zonder logopedie</option>
        </select>
      </Field>

      <Field label="Leersteun">
        <select
          value={get("leersteun")}
          onChange={(e) => update("leersteun", e.target.value)}
          className={selectCls}
        >
          <option value="">Alle</option>
          <option value="ja">Met leersteun</option>
          <option value="nee">Zonder leersteun</option>
        </select>
      </Field>

      <Field label="Type diagnose">
        <select
          value={get("diagnose")}
          onChange={(e) => update("diagnose", e.target.value)}
          className={selectCls}
        >
          <option value="">Alle diagnoses</option>
          {diagnoseTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-end">
        <button
          onClick={() => router.push("/dashboard")}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Filters wissen
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}
