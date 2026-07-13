"use client";

import { useState } from "react";
import {
  updateZorgprofiel,
  voegDiagnoseToe,
  updateDiagnose,
  verwijderDiagnose,
} from "./zorgprofiel/actions";
import { formatDatum } from "@/lib/format";

interface Diagnose {
  id: string;
  type: string;
  datum: string; // YYYY-MM-DD
  bron: string;
}

interface ZorgprofielData {
  logo: boolean;
  logoOmschrijving: string;
  leersteun: boolean;
  leersteunUren: number;
  leersteunType: string;
  zorgmaatregelen: string;
  diagnoses: Diagnose[];
}

interface Props {
  leerlingId: string;
  zorgprofiel: ZorgprofielData | null;
}

export default function ZorgprofielEditor({ leerlingId, zorgprofiel }: Props) {
  const zp = zorgprofiel;
  const [logoAan, setLogoAan] = useState(zp?.logo ?? false);
  const [leersteunAan, setLeersteunAan] = useState(zp?.leersteun ?? false);
  const [bewerkDiagnose, setBewerkDiagnose] = useState<string | null>(null);
  const [bewaard, setBewaard] = useState(false);

  const inputCls =
    "w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="space-y-5 text-sm">
      {/* Hoofdvelden */}
      <form
        action={async (fd) => {
          await updateZorgprofiel(fd);
          setBewaard(true);
          setTimeout(() => setBewaard(false), 2000);
        }}
        className="space-y-4"
      >
        <input type="hidden" name="leerlingId" value={leerlingId} />

        {/* Logopedie */}
        <div className="rounded-lg border border-slate-100 p-3">
          <label className="flex items-center gap-2 font-medium text-slate-700">
            <input
              type="checkbox"
              name="logo"
              checked={logoAan}
              onChange={(e) => setLogoAan(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Logopedie
          </label>
          {logoAan && (
            <textarea
              name="logoOmschrijving"
              rows={2}
              defaultValue={zp?.logoOmschrijving ?? ""}
              placeholder="Omschrijving (bv. articulatie, fonologisch bewustzijn)"
              className={`mt-2 ${inputCls}`}
            />
          )}
        </div>

        {/* Leersteun */}
        <div className="rounded-lg border border-slate-100 p-3">
          <label className="flex items-center gap-2 font-medium text-slate-700">
            <input
              type="checkbox"
              name="leersteun"
              checked={leersteunAan}
              onChange={(e) => setLeersteunAan(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Leersteun
          </label>
          {leersteunAan && (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">
                  Uren per week
                </label>
                <input
                  type="number"
                  name="leersteunUren"
                  step="0.5"
                  min={0}
                  defaultValue={zp?.leersteunUren ?? 0}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Type</label>
                <input
                  type="text"
                  name="leersteunType"
                  defaultValue={zp?.leersteunType ?? ""}
                  placeholder="bv. Lezen & spelling"
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>

        {/* Zorgmaatregelen */}
        <div>
          <label className="mb-1 block font-medium text-slate-700">
            Zorgmaatregelen
          </label>
          <textarea
            name="zorgmaatregelen"
            rows={3}
            defaultValue={zp?.zorgmaatregelen ?? ""}
            placeholder="Vrije tekst met afspraken en maatregelen..."
            className={inputCls}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Zorgprofiel opslaan
          </button>
          {bewaard && (
            <span className="text-sm font-medium text-green-600">
              ✅ Opgeslagen
            </span>
          )}
        </div>
      </form>

      {/* Diagnoses */}
      <div className="border-t border-slate-100 pt-4">
        <h3 className="mb-2 font-medium text-slate-700">Diagnoses</h3>
        <div className="space-y-2">
          {(zp?.diagnoses ?? []).map((d) =>
            bewerkDiagnose === d.id ? (
              <form
                key={d.id}
                action={async (fd) => {
                  await updateDiagnose(fd);
                  setBewerkDiagnose(null);
                }}
                className="space-y-2 rounded-lg border border-brand-200 bg-brand-50 p-2"
              >
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="leerlingId" value={leerlingId} />
                <input
                  type="text"
                  name="type"
                  required
                  defaultValue={d.type}
                  placeholder="Type diagnose"
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    name="datum"
                    defaultValue={d.datum}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    name="bron"
                    defaultValue={d.bron}
                    placeholder="Bron"
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    Opslaan
                  </button>
                  <button
                    type="button"
                    onClick={() => setBewerkDiagnose(null)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600"
                  >
                    Annuleren
                  </button>
                </div>
              </form>
            ) : (
              <div
                key={d.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
              >
                <div>
                  <span className="font-medium text-slate-700">{d.type}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {formatDatum(d.datum)}
                    {d.bron ? ` · ${d.bron}` : ""}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setBewerkDiagnose(d.id)}
                    className="text-slate-400 hover:text-brand-600"
                    title="Bewerken"
                  >
                    ✏️
                  </button>
                  <form action={verwijderDiagnose}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="leerlingId" value={leerlingId} />
                    <button
                      type="submit"
                      className="text-slate-300 hover:text-red-500"
                      title="Verwijderen"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </div>
            )
          )}
          {(zp?.diagnoses.length ?? 0) === 0 && (
            <p className="text-slate-400">Nog geen diagnoses.</p>
          )}
        </div>

        {/* Diagnose toevoegen */}
        <form
          action={async (fd) => {
            await voegDiagnoseToe(fd);
            (document.getElementById(
              `diagnose-form-${leerlingId}`
            ) as HTMLFormElement)?.reset();
          }}
          id={`diagnose-form-${leerlingId}`}
          className="mt-3 space-y-2 rounded-lg border border-dashed border-slate-300 p-3"
        >
          <input type="hidden" name="leerlingId" value={leerlingId} />
          <div className="text-xs font-medium text-slate-500">
            Diagnose toevoegen
          </div>
          <input
            type="text"
            name="type"
            required
            placeholder="Type diagnose (bv. Dyslexie)"
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="datum" className={inputCls} />
            <input
              type="text"
              name="bron"
              placeholder="Bron (bv. CLB)"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            + Toevoegen
          </button>
        </form>
      </div>
    </div>
  );
}
