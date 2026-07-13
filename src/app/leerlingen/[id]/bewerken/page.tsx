import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LeerlingForm from "../../LeerlingForm";

export const dynamic = "force-dynamic";

export default async function LeerlingBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [leerling, klassen] = await Promise.all([
    prisma.leerling.findUnique({ where: { id } }),
    prisma.klas.findMany({ orderBy: { naam: "asc" } }),
  ]);

  if (!leerling) notFound();

  return (
    <div className="space-y-5">
      <Link
        href={`/leerlingen/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        ← Terug naar dossier
      </Link>
      <h1 className="text-2xl font-bold text-slate-800">
        Leerling bewerken — {leerling.voornaam} {leerling.achternaam}
      </h1>
      <LeerlingForm
        klassen={klassen}
        leerling={{
          id: leerling.id,
          voornaam: leerling.voornaam,
          achternaam: leerling.achternaam,
          geboortedatum: leerling.geboortedatum.toISOString().slice(0, 10),
          klasId: leerling.klasId,
          leerjaar: leerling.leerjaar,
          schooljaar: leerling.schooljaar,
          status: leerling.status,
        }}
      />
    </div>
  );
}
