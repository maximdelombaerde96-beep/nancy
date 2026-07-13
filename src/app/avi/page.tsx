import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AviForm from "./AviForm";
import { statusColor, statusLabel, type AviStatus } from "@/lib/avi";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ leerling?: string }>;
}

export default async function AviPage({ searchParams }: Props) {
  const sp = await searchParams;

  const klassen = await prisma.klas.findMany({
    orderBy: { naam: "asc" },
    include: {
      leerlingen: {
        include: { aviResultaten: { orderBy: { datum: "desc" }, take: 1 } },
        orderBy: [{ achternaam: "asc" }, { voornaam: "asc" }],
      },
    },
  });

  const leerlingenFlat = klassen.flatMap((k) =>
    k.leerlingen.map((l) => ({
      id: l.id,
      voornaam: l.voornaam,
      achternaam: l.achternaam,
      leerjaar: l.leerjaar,
      klasNaam: k.naam,
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">AVI-overzicht</h1>
        <p className="text-sm text-slate-500">
          Registreer leesresultaten en volg per klas op wie onder, op of boven
          niveau leest.
        </p>
      </div>

      <AviForm leerlingen={leerlingenFlat} preselect={sp.leerling} />

      {/* Klasoverzicht */}
      <div className="space-y-5">
        <h2 className="text-lg font-semibold text-slate-800">
          Klasoverzicht (op basis van laatste AVI-toets)
        </h2>
        {klassen.map((klas) => {
          const metResultaat = klas.leerlingen.filter(
            (l) => l.aviResultaten.length > 0
          );
          const tellingen = { onder: 0, op: 0, boven: 0 } as Record<
            AviStatus,
            number
          >;
          for (const l of metResultaat) {
            const s = l.aviResultaten[0].status as AviStatus;
            if (s in tellingen) tellingen[s]++;
          }
          const zonder = klas.leerlingen.length - metResultaat.length;

          return (
            <div
              key={klas.id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">
                  Klas {klas.naam}{" "}
                  <span className="text-sm font-normal text-slate-400">
                    · {klas.leerlingen.length} leerlingen
                  </span>
                </h3>
              </div>

              {/* Samenvatting */}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Onder niveau"
                  value={tellingen.onder}
                  className="bg-red-50 text-red-700"
                />
                <StatCard
                  label="Op niveau"
                  value={tellingen.op}
                  className="bg-green-50 text-green-700"
                />
                <StatCard
                  label="Boven niveau"
                  value={tellingen.boven}
                  className="bg-blue-50 text-blue-700"
                />
                <StatCard
                  label="Nog geen toets"
                  value={zonder}
                  className="bg-slate-50 text-slate-500"
                />
              </div>

              {/* Detail per leerling */}
              <div className="overflow-hidden rounded-lg border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Leerling</th>
                      <th className="px-3 py-2 font-medium">Toets</th>
                      <th className="px-3 py-2 font-medium">Tijd / fouten</th>
                      <th className="px-3 py-2 font-medium">Niveau</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {klas.leerlingen.map((l) => {
                      const a = l.aviResultaten[0];
                      return (
                        <tr key={l.id}>
                          <td className="px-3 py-2">
                            <Link
                              href={`/leerlingen/${l.id}`}
                              className="text-brand-700 hover:underline"
                            >
                              {l.achternaam}, {l.voornaam}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {a?.toetsmoment ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {a ? `${a.leestijdSeconden}s / ${a.fouten}` : "—"}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-700">
                            {a?.aviNiveau ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            {a ? (
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                                  statusColor[a.status as AviStatus]
                                }`}
                              >
                                {statusLabel[a.status as AviStatus]}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
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
