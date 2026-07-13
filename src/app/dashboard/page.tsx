import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Badge from "@/components/Badge";
import DashboardFilters from "./DashboardFilters";
import { zorgStatusColor, zorgStatusLabel } from "@/lib/format";
import { statusColor, statusLabel, type AviStatus } from "@/lib/avi";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    klas?: string;
    leerjaar?: string;
    status?: string;
    avi?: string;
    logo?: string;
    leersteun?: string;
    diagnose?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const sp = await searchParams;

  // --- Filters op leerling- en zorgprofiel-niveau (in de query) ---
  const and: Prisma.LeerlingWhereInput[] = [{ gearchiveerd: false }];
  if (sp.klas) and.push({ klasId: sp.klas });
  if (sp.leerjaar) and.push({ leerjaar: Number(sp.leerjaar) });
  if (sp.status) and.push({ status: sp.status });

  // Positieve zorgprofiel-filters worden samengevoegd tot één relatie-filter.
  const zpIs: Prisma.ZorgprofielWhereInput = {};
  if (sp.logo === "ja") zpIs.logo = true;
  if (sp.leersteun === "ja") zpIs.leersteun = true;
  if (sp.diagnose) zpIs.diagnoses = { some: { type: sp.diagnose } };
  if (Object.keys(zpIs).length) and.push({ zorgprofiel: { is: zpIs } });

  // "Zonder ..." filters (negatie).
  if (sp.logo === "nee") and.push({ NOT: { zorgprofiel: { is: { logo: true } } } });
  if (sp.leersteun === "nee")
    and.push({ NOT: { zorgprofiel: { is: { leersteun: true } } } });

  const [leerlingenRaw, klassen, diagnoseTypesRaw] = await Promise.all([
    prisma.leerling.findMany({
      where: { AND: and },
      include: {
        klas: true,
        zorgprofiel: { select: { logo: true, leersteun: true } },
        aviResultaten: { orderBy: { datum: "desc" }, take: 1 },
      },
      orderBy: [{ achternaam: "asc" }, { voornaam: "asc" }],
    }),
    prisma.klas.findMany({ orderBy: { naam: "asc" } }),
    prisma.diagnose.findMany({
      distinct: ["type"],
      select: { type: true },
      orderBy: { type: "asc" },
    }),
  ]);

  // --- AVI-statusfilter: hangt af van de laatste toets, dus in-memory ---
  const leerlingen = leerlingenRaw.filter((l) => {
    if (!sp.avi) return true;
    const laatste = l.aviResultaten[0];
    if (sp.avi === "geen") return !laatste;
    return laatste?.status === sp.avi;
  });

  const leerjaren = [...new Set(klassen.map((k) => k.leerjaar))].sort();
  const diagnoseTypes = diagnoseTypesRaw.map((d) => d.type);

  // Kleine samenvatting bovenaan.
  const aantalOnder = leerlingen.filter(
    (l) => l.aviResultaten[0]?.status === "onder"
  ).length;
  const aantalLogo = leerlingen.filter((l) => l.zorgprofiel?.logo).length;
  const aantalLeersteun = leerlingen.filter(
    (l) => l.zorgprofiel?.leersteun
  ).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Filter leerlingen op zorgkenmerken en leesniveau, en spring rechtstreeks
          naar hun dossier.
        </p>
      </div>

      {/* Samenvatting */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Leerlingen (selectie)" value={leerlingen.length} className="bg-slate-50 text-slate-700" />
        <StatCard label="Onder AVI-niveau" value={aantalOnder} className="bg-red-50 text-red-700" />
        <StatCard label="Met logopedie" value={aantalLogo} className="bg-brand-50 text-brand-700" />
        <StatCard label="Met leersteun" value={aantalLeersteun} className="bg-amber-50 text-amber-700" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <DashboardFilters
          klassen={klassen}
          leerjaren={leerjaren}
          diagnoseTypes={diagnoseTypes}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Naam</th>
              <th className="px-4 py-3 font-medium">Klas</th>
              <th className="px-4 py-3 font-medium">Leerjaar</th>
              <th className="px-4 py-3 font-medium">Zorgstatus</th>
              <th className="px-4 py-3 font-medium">Zorg</th>
              <th className="px-4 py-3 font-medium">AVI-status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leerlingen.map((l) => {
              const avi = l.aviResultaten[0];
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {l.achternaam}, {l.voornaam}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.klas?.naam ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.leerjaar}</td>
                  <td className="px-4 py-3">
                    <Badge className={zorgStatusColor(l.status)}>
                      {zorgStatusLabel(l.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {l.zorgprofiel?.logo && (
                        <Badge className="border-brand-200 bg-brand-50 text-brand-700">
                          Logo
                        </Badge>
                      )}
                      {l.zorgprofiel?.leersteun && (
                        <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                          Leersteun
                        </Badge>
                      )}
                      {!l.zorgprofiel?.logo && !l.zorgprofiel?.leersteun && (
                        <span className="text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {avi ? (
                      <Badge className={statusColor[avi.status as AviStatus]}>
                        {statusLabel[avi.status as AviStatus]} · {avi.aviNiveau}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">Nog geen toets</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`/leerlingen/${l.id}/opname`}
                        title="Oudergesprek opnemen"
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        🎙️
                      </Link>
                      <Link
                        href={`/leerlingen/${l.id}`}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-brand-700 hover:bg-slate-50"
                      >
                        Dossier →
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {leerlingen.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  Geen leerlingen voldoen aan de huidige filters.
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
