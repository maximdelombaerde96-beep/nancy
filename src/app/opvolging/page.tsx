import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Badge from "@/components/Badge";
import AfgerondToggle from "@/components/AfgerondToggle";
import OpvolgingFilters from "./OpvolgingFilters";
import { formatDatum } from "@/lib/format";
import {
  opvolgUrgentie,
  urgentieColor,
  urgentieLabel,
  type OpvolgUrgentie,
} from "@/lib/opvolging";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    status?: string;
    urgentie?: string;
    leerling?: string;
  }>;
}

export default async function OpvolgingPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = sp.status || "open"; // standaard: enkel openstaande

  const where: Prisma.ActieWhereInput = { opvolgdatum: { not: null } };
  if (status === "open") where.afgerond = false;
  if (status === "afgerond") where.afgerond = true;
  if (sp.leerling) where.leerlingId = sp.leerling;

  const acties = await prisma.actie.findMany({
    where,
    include: { leerling: true },
    orderBy: { opvolgdatum: "asc" },
  });

  const now = new Date();

  // Urgentie in-memory bepalen en (optioneel) filteren.
  const rijen = acties
    .map((a) => ({
      actie: a,
      urgentie: opvolgUrgentie(a.opvolgdatum!, now),
    }))
    .filter((r) => !sp.urgentie || r.urgentie === sp.urgentie);

  // Tellingen voor de samenvatting (enkel over openstaande acties).
  const openActies = acties.filter((a) => !a.afgerond);
  const telling = { verlopen: 0, binnenkort: 0, later: 0 } as Record<
    OpvolgUrgentie,
    number
  >;
  for (const a of openActies) telling[opvolgUrgentie(a.opvolgdatum!, now)]++;

  // Leerlingen voor de filter-dropdown (met opvolgacties).
  const leerlingenMap = new Map<string, string>();
  for (const a of acties)
    leerlingenMap.set(
      a.leerling.id,
      `${a.leerling.achternaam}, ${a.leerling.voornaam}`
    );
  const leerlingen = [...leerlingenMap.entries()]
    .map(([id, naam]) => ({ id, naam }))
    .sort((a, b) => a.naam.localeCompare(b.naam));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Opvolgacties</h1>
        <p className="text-sm text-slate-500">
          Alle acties met een opvolgdatum, gesorteerd op vervaldatum.
        </p>
      </div>

      {/* Samenvatting van openstaande acties */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Verlopen"
          value={telling.verlopen}
          className="bg-red-50 text-red-700"
        />
        <StatCard
          label="Binnenkort (≤ 14 d)"
          value={telling.binnenkort}
          className="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Later"
          value={telling.later}
          className="bg-slate-50 text-slate-600"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <OpvolgingFilters leerlingen={leerlingen} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Opvolgdatum</th>
              <th className="px-4 py-3 font-medium">Leerling</th>
              <th className="px-4 py-3 font-medium">Actie</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rijen.map(({ actie: a, urgentie }) => (
              <tr key={a.id} className="align-top hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-slate-700">
                      {formatDatum(a.opvolgdatum!)}
                    </span>
                    {!a.afgerond && (
                      <Badge className={urgentieColor[urgentie]}>
                        {urgentieLabel[urgentie]}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/leerlingen/${a.leerlingId}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {a.leerling.achternaam}, {a.leerling.voornaam}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        a.type === "actie"
                          ? "border-brand-200 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-slate-100 text-slate-600"
                      }
                    >
                      {a.type === "actie" ? "Actie" : "Notitie"}
                    </Badge>
                    <span className="text-slate-700">{a.tekst}</span>
                  </div>
                  {a.auteur && (
                    <div className="mt-0.5 text-xs text-slate-400">
                      {a.auteur}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <AfgerondToggle
                    actieId={a.id}
                    leerlingId={a.leerlingId}
                    afgerond={a.afgerond}
                  />
                </td>
              </tr>
            ))}
            {rijen.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  Geen opvolgacties met deze filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${className}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}
