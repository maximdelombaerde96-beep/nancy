import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Badge from "@/components/Badge";
import {
  berekenLeeftijd,
  formatDatum,
  zorgStatusColor,
  zorgStatusLabel,
} from "@/lib/format";
import { statusColor, statusLabel, type AviStatus } from "@/lib/avi";
import ActieForm from "./ActieForm";
import ZorgstatusSelect from "./ZorgstatusSelect";
import { verwijderActie } from "../actions";

export const dynamic = "force-dynamic";

export default async function DossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const leerling = await prisma.leerling.findUnique({
    where: { id },
    include: {
      klas: true,
      zorgprofiel: { include: { diagnoses: { orderBy: { datum: "desc" } } } },
      aviResultaten: { orderBy: { datum: "asc" } },
      acties: { orderBy: { datum: "desc" } },
      verslagen: { orderBy: { datum: "desc" } },
    },
  });

  if (!leerling) notFound();

  const zp = leerling.zorgprofiel;

  return (
    <div className="space-y-6">
      <Link
        href="/leerlingen"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        ← Terug naar leerlingenlijst
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {leerling.voornaam} {leerling.achternaam}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>Klas {leerling.klas?.naam ?? "—"}</span>
              <span>Leerjaar {leerling.leerjaar}</span>
              <span>Schooljaar {leerling.schooljaar}</span>
              <span>
                {berekenLeeftijd(leerling.geboortedatum)} jaar (
                {formatDatum(leerling.geboortedatum)})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={zorgStatusColor(leerling.status)}>
              {zorgStatusLabel(leerling.status)}
            </Badge>
            <ZorgstatusSelect leerlingId={leerling.id} status={leerling.status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Zorgprofiel */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-1">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">
            Zorgprofiel
          </h2>
          {zp ? (
            <div className="space-y-4 text-sm">
              <div>
                <div className="font-medium text-slate-700">Logopedie</div>
                {zp.logo ? (
                  <p className="text-slate-600">
                    ✅ {zp.logoOmschrijving || "Actief"}
                  </p>
                ) : (
                  <p className="text-slate-400">Geen</p>
                )}
              </div>
              <div>
                <div className="font-medium text-slate-700">Leersteun</div>
                {zp.leersteun ? (
                  <p className="text-slate-600">
                    ✅ {zp.leersteunUren} u/week · {zp.leersteunType || "—"}
                  </p>
                ) : (
                  <p className="text-slate-400">Geen</p>
                )}
              </div>
              <div>
                <div className="font-medium text-slate-700">Diagnoses</div>
                {zp.diagnoses.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {zp.diagnoses.map((d) => (
                      <li key={d.id} className="text-slate-600">
                        • {d.type}{" "}
                        <span className="text-slate-400">
                          ({formatDatum(d.datum)}, {d.bron})
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400">Geen</p>
                )}
              </div>
              <div>
                <div className="font-medium text-slate-700">Zorgmaatregelen</div>
                <p className="whitespace-pre-wrap text-slate-600">
                  {zp.zorgmaatregelen || (
                    <span className="text-slate-400">Geen</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Nog geen zorgprofiel voor deze leerling.
            </p>
          )}
        </section>

        {/* AVI-tijdlijn */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">AVI-tijdlijn</h2>
            <Link
              href={`/avi?leerling=${leerling.id}`}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              + Nieuwe AVI-toets
            </Link>
          </div>
          {leerling.aviResultaten.length > 0 ? (
            <div className="space-y-2">
              {leerling.aviResultaten.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-12 font-semibold text-slate-700">
                      {a.toetsmoment}
                    </span>
                    <span className="text-slate-500">{formatDatum(a.datum)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-600">
                      {a.leestijdSeconden}s · {a.fouten} fout
                      {a.fouten === 1 ? "" : "en"}
                    </span>
                    <span className="font-medium text-slate-700">
                      {a.aviNiveau}
                    </span>
                    <Badge className={statusColor[a.status as AviStatus]}>
                      {statusLabel[a.status as AviStatus]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Nog geen AVI-resultaten geregistreerd.
            </p>
          )}
        </section>
      </div>

      {/* Acties & notities */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">
          Acties &amp; notities
        </h2>
        <ActieForm leerlingId={leerling.id} />
        <div className="mt-4 space-y-2">
          {leerling.acties.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      a.type === "actie"
                        ? "bg-brand-50 text-brand-700 border-brand-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }
                  >
                    {a.type === "actie" ? "Actie" : "Notitie"}
                  </Badge>
                  <span className="text-slate-400">{formatDatum(a.datum)}</span>
                  {a.auteur && (
                    <span className="text-slate-400">· {a.auteur}</span>
                  )}
                  {a.opvolgdatum && (
                    <span className="text-amber-600">
                      · opvolgen: {formatDatum(a.opvolgdatum)}
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {a.tekst}
                </p>
              </div>
              <form action={verwijderActie}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="leerlingId" value={leerling.id} />
                <button
                  type="submit"
                  className="text-slate-300 hover:text-red-500"
                  title="Verwijderen"
                >
                  ✕
                </button>
              </form>
            </div>
          ))}
          {leerling.acties.length === 0 && (
            <p className="text-sm text-slate-400">Nog geen acties of notities.</p>
          )}
        </div>
      </section>

      {/* Verslagen */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Verslagen</h2>
          <Link
            href={`/leerlingen/${leerling.id}/verslag/nieuw`}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Nieuw verslag
          </Link>
        </div>
        {leerling.verslagen.length > 0 ? (
          <div className="space-y-2">
            {leerling.verslagen.map((v) => (
              <Link
                key={v.id}
                href={`/leerlingen/${leerling.id}/verslag/${v.id}`}
                className="block rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">
                    Verslag {formatDatum(v.datum)}
                  </span>
                  {v.opvolgdatum && (
                    <span className="text-xs text-amber-600">
                      Opvolgen: {formatDatum(v.opvolgdatum)}
                    </span>
                  )}
                </div>
                {v.aanwezigen && (
                  <p className="text-xs text-slate-400">
                    Aanwezig: {v.aanwezigen}
                  </p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nog geen verslagen.</p>
        )}
      </section>
    </div>
  );
}
