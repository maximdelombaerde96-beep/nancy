import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/components/PrintButton";
import AviChart from "../AviChart";
import {
  berekenLeeftijd,
  formatDatum,
  zorgStatusLabel,
} from "@/lib/format";
import { statusLabel, type AviStatus } from "@/lib/avi";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}

export default async function DossierPrintPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { auto } = await searchParams;

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
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-2 text-slate-800">
      {/* Toolbar (niet mee geprint) */}
      <div className="no-print flex items-center justify-between border-b border-slate-200 pb-3">
        <Link
          href={`/leerlingen/${id}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Terug naar dossier
        </Link>
        <PrintButton auto={auto === "1"} />
      </div>

      {/* Documenthoofding */}
      <header className="print-avoid-break border-b border-slate-300 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Zorgdossier — {leerling.voornaam} {leerling.achternaam}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Klas {leerling.klas?.naam ?? "—"} · Leerjaar {leerling.leerjaar} ·
              Schooljaar {leerling.schooljaar}
            </p>
            <p className="text-sm text-slate-600">
              Geboortedatum {formatDatum(leerling.geboortedatum)} (
              {berekenLeeftijd(leerling.geboortedatum)} jaar) · Zorgstatus:{" "}
              {zorgStatusLabel(leerling.status)}
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div className="font-semibold text-slate-500">Zorgdossier Tool</div>
            <div>Afgedrukt op {formatDatum(new Date())}</div>
          </div>
        </div>
      </header>

      {/* Zorgprofiel */}
      <section className="print-avoid-break space-y-2">
        <h2 className="text-lg font-semibold">Zorgprofiel</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            <Rij label="Logopedie">
              {zp?.logo ? zp.logoOmschrijving || "Actief" : "Geen"}
            </Rij>
            <Rij label="Leersteun">
              {zp?.leersteun
                ? `${zp.leersteunUren} u/week · ${zp.leersteunType || "—"}`
                : "Geen"}
            </Rij>
            <Rij label="Diagnoses">
              {zp && zp.diagnoses.length > 0 ? (
                <ul className="space-y-0.5">
                  {zp.diagnoses.map((d) => (
                    <li key={d.id}>
                      {d.type}{" "}
                      <span className="text-slate-500">
                        ({formatDatum(d.datum)}
                        {d.bron ? `, ${d.bron}` : ""})
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                "Geen"
              )}
            </Rij>
            <Rij label="Zorgmaatregelen">
              <span className="whitespace-pre-wrap">
                {zp?.zorgmaatregelen || "Geen"}
              </span>
            </Rij>
          </tbody>
        </table>
      </section>

      {/* AVI */}
      <section className="print-avoid-break space-y-2">
        <h2 className="text-lg font-semibold">AVI-evolutie</h2>
        {leerling.aviResultaten.length > 0 ? (
          <>
            <div className="rounded-lg border border-slate-200 p-3">
              <AviChart
                punten={leerling.aviResultaten.map((a) => ({
                  toetsmoment: a.toetsmoment,
                  datum: a.datum.toISOString(),
                  aviNiveau: a.aviNiveau,
                  status: a.status,
                  leestijdSeconden: a.leestijdSeconden,
                  fouten: a.fouten,
                }))}
              />
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1">Toets</th>
                  <th className="py-1">Datum</th>
                  <th className="py-1">Leestijd</th>
                  <th className="py-1">Fouten</th>
                  <th className="py-1">Niveau</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leerling.aviResultaten.map((a) => (
                  <tr key={a.id}>
                    <td className="py-1 font-medium">{a.toetsmoment}</td>
                    <td className="py-1">{formatDatum(a.datum)}</td>
                    <td className="py-1">{a.leestijdSeconden}s</td>
                    <td className="py-1">{a.fouten}</td>
                    <td className="py-1">{a.aviNiveau}</td>
                    <td className="py-1">
                      {statusLabel[a.status as AviStatus] ?? a.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-sm text-slate-500">Geen AVI-resultaten.</p>
        )}
      </section>

      {/* Acties */}
      <section className="print-avoid-break space-y-2">
        <h2 className="text-lg font-semibold">Acties &amp; notities</h2>
        {leerling.acties.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {leerling.acties.map((a) => (
              <li key={a.id} className="border-b border-slate-100 pb-1.5">
                <span className="font-medium">
                  {a.type === "actie" ? "Actie" : "Notitie"}
                </span>{" "}
                <span className="text-slate-500">
                  · {formatDatum(a.datum)}
                  {a.auteur ? ` · ${a.auteur}` : ""}
                  {a.opvolgdatum
                    ? ` · opvolgen: ${formatDatum(a.opvolgdatum)}${
                        a.afgerond ? " (afgerond)" : ""
                      }`
                    : ""}
                </span>
                <div className={a.afgerond ? "text-slate-400 line-through" : ""}>
                  {a.tekst}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Geen acties of notities.</p>
        )}
      </section>

      {/* Verslagen */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Verslagen</h2>
        {leerling.verslagen.length > 0 ? (
          leerling.verslagen.map((v) => (
            <div
              key={v.id}
              className="print-avoid-break rounded-lg border border-slate-200 p-3 text-sm"
            >
              <div className="mb-1 font-medium">
                Verslag {formatDatum(v.datum)}
                {v.aanwezigen ? ` — aanwezig: ${v.aanwezigen}` : ""}
              </div>
              <p className="whitespace-pre-wrap text-slate-700">
                {v.gegenereerdVerslag}
              </p>
              {v.actiepunten && (
                <div className="mt-2">
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    Actiepunten
                  </div>
                  <p className="whitespace-pre-wrap text-slate-700">
                    {v.actiepunten}
                  </p>
                </div>
              )}
              {v.opvolgdatum && (
                <div className="mt-1 text-xs text-slate-500">
                  Opvolgdatum: {formatDatum(v.opvolgdatum)}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Geen verslagen.</p>
        )}
      </section>
    </div>
  );
}

function Rij({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td className="w-40 py-2 align-top font-medium text-slate-600">{label}</td>
      <td className="py-2 align-top text-slate-800">{children}</td>
    </tr>
  );
}
