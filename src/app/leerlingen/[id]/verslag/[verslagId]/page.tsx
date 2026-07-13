import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDatum } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function VerslagDetailPage({
  params,
}: {
  params: Promise<{ id: string; verslagId: string }>;
}) {
  const { id, verslagId } = await params;

  const verslag = await prisma.verslag.findUnique({
    where: { id: verslagId },
    include: { leerling: true },
  });

  if (!verslag || verslag.leerlingId !== id) notFound();

  return (
    <div className="space-y-5">
      <div className="no-print flex items-center justify-between">
        <Link
          href={`/leerlingen/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          ← Terug naar dossier
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 print:border-0 print:p-0">
        <div className="mb-4 border-b border-slate-100 pb-4">
          <h1 className="text-xl font-bold text-slate-800">
            Verslag — {verslag.leerling.voornaam} {verslag.leerling.achternaam}
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-slate-500">
            <span>Datum: {formatDatum(verslag.datum)}</span>
            {verslag.aanwezigen && <span>Aanwezig: {verslag.aanwezigen}</span>}
            {verslag.opvolgdatum && (
              <span className="text-amber-600">
                Opvolgen: {formatDatum(verslag.opvolgdatum)}
              </span>
            )}
          </div>
        </div>

        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Verslag
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {verslag.gegenereerdVerslag}
          </p>
        </section>

        {verslag.actiepunten && (
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Actiepunten
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {verslag.actiepunten}
            </p>
          </section>
        )}

        {verslag.brontekst && (
          <details className="rounded-lg bg-slate-50 p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">
              Originele notities (brontekst)
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {verslag.brontekst}
            </p>
          </details>
        )}
      </div>
    </div>
  );
}
