import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import VerslagWizard from "./VerslagWizard";

export const dynamic = "force-dynamic";

export default async function NieuwVerslagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const leerling = await prisma.leerling.findUnique({ where: { id } });
  if (!leerling) notFound();

  const apiKeyAanwezig = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

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
          Nieuw verslag — {leerling.voornaam} {leerling.achternaam}
        </h1>
        <p className="text-sm text-slate-500">
          Typ losse notities over een oudergesprek of overleg. De tool zet ze om
          in een professioneel verslag met actiepunten en een voorgestelde
          opvolgdatum.
        </p>
      </div>

      <VerslagWizard
        leerlingId={leerling.id}
        leerlingNaam={`${leerling.voornaam} ${leerling.achternaam}`}
        apiKeyAanwezig={apiKeyAanwezig}
      />
    </div>
  );
}
