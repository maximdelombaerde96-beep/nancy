import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Badge from "@/components/Badge";
import LeerlingenFilter from "./LeerlingenFilter";
import {
  berekenLeeftijd,
  zorgStatusColor,
  zorgStatusLabel,
} from "@/lib/format";
import { statusColor, statusLabel, type AviStatus } from "@/lib/avi";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    q?: string;
    klas?: string;
    leerjaar?: string;
    status?: string;
    archief?: string;
  }>;
}

export default async function LeerlingenPage({ searchParams }: Props) {
  const sp = await searchParams;
  const toonArchief = sp.archief === "1";

  const where: Prisma.LeerlingWhereInput = {};
  where.gearchiveerd = toonArchief ? true : false;
  if (sp.klas) where.klasId = sp.klas;
  if (sp.leerjaar) where.leerjaar = Number(sp.leerjaar);
  if (sp.status) where.status = sp.status;
  if (sp.q) {
    where.OR = [
      { voornaam: { contains: sp.q, mode: "insensitive" } },
      { achternaam: { contains: sp.q, mode: "insensitive" } },
    ];
  }

  const [leerlingen, klassen, aantalArchief] = await Promise.all([
    prisma.leerling.findMany({
      where,
      include: {
        klas: true,
        aviResultaten: { orderBy: { datum: "desc" }, take: 1 },
      },
      orderBy: [{ achternaam: "asc" }, { voornaam: "asc" }],
    }),
    prisma.klas.findMany({ orderBy: { naam: "asc" } }),
    prisma.leerling.count({ where: { gearchiveerd: true } }),
  ]);

  const leerjaren = [...new Set(klassen.map((k) => k.leerjaar))].sort();

  // Behoud de actieve filters bij het wisselen tussen actief/archief.
  const filterParams = new URLSearchParams();
  if (sp.q) filterParams.set("q", sp.q);
  if (sp.klas) filterParams.set("klas", sp.klas);
  if (sp.leerjaar) filterParams.set("leerjaar", sp.leerjaar);
  if (sp.status) filterParams.set("status", sp.status);
  const archiefHref = (aan: boolean) => {
    const p = new URLSearchParams(filterParams);
    if (aan) p.set("archief", "1");
    const qs = p.toString();
    return `/leerlingen${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {toonArchief ? "Gearchiveerde leerlingen" : "Leerlingen"}
          </h1>
          <p className="text-sm text-slate-500">
            {leerlingen.length} leerling{leerlingen.length === 1 ? "" : "en"}{" "}
            gevonden
          </p>
        </div>
        <Link
          href="/leerlingen/nieuw"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Nieuwe leerling
        </Link>
      </div>

      {/* Actief / archief-schakelaar */}
      <div className="flex gap-1 text-sm">
        <Link
          href={archiefHref(false)}
          className={`rounded-md px-3 py-1.5 font-medium ${
            !toonArchief
              ? "bg-brand-50 text-brand-700"
              : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          Actief
        </Link>
        <Link
          href={archiefHref(true)}
          className={`rounded-md px-3 py-1.5 font-medium ${
            toonArchief
              ? "bg-brand-50 text-brand-700"
              : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          Archief{aantalArchief > 0 ? ` (${aantalArchief})` : ""}
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <LeerlingenFilter klassen={klassen} leerjaren={leerjaren} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Naam</th>
              <th className="px-4 py-3 font-medium">Klas</th>
              <th className="px-4 py-3 font-medium">Leeftijd</th>
              <th className="px-4 py-3 font-medium">Zorgstatus</th>
              <th className="px-4 py-3 font-medium">Laatste AVI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leerlingen.map((l) => {
              const laatsteAvi = l.aviResultaten[0];
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/leerlingen/${l.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {l.achternaam}, {l.voornaam}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.klas?.naam ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {berekenLeeftijd(l.geboortedatum)} jaar
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={zorgStatusColor(l.status)}>
                      {zorgStatusLabel(l.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {laatsteAvi ? (
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">
                          {laatsteAvi.aviNiveau}
                        </span>
                        <Badge className={statusColor[laatsteAvi.status as AviStatus]}>
                          {statusLabel[laatsteAvi.status as AviStatus]}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {leerlingen.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  {toonArchief
                    ? "Geen gearchiveerde leerlingen."
                    : "Geen leerlingen gevonden met deze filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
