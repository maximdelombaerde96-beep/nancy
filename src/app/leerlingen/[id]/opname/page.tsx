import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OpnameRecorder from "./OpnameRecorder";

export const dynamic = "force-dynamic";

export default async function OpnamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const leerling = await prisma.leerling.findUnique({ where: { id } });
  if (!leerling) notFound();

  const naam = `${leerling.voornaam} ${leerling.achternaam}`;

  return (
    <div className="space-y-5">
      <Link
        href={`/leerlingen/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        ← Terug naar dossier
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Oudergesprek opnemen — {naam}
        </h1>
        <p className="text-sm text-slate-500">
          Neem het gesprek op en bouw tegelijk een live transcript op. Na het
          stoppen kan je het transcript corrigeren en er een verslag van maken.
        </p>
      </div>

      <OpnameRecorder leerlingId={leerling.id} leerlingNaam={naam} />
    </div>
  );
}
