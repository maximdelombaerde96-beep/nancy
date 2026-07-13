import Link from "next/link";
import { prisma } from "@/lib/prisma";
import LeerlingForm from "../LeerlingForm";

export const dynamic = "force-dynamic";

export default async function NieuweLeerlingPage() {
  const klassen = await prisma.klas.findMany({ orderBy: { naam: "asc" } });

  return (
    <div className="space-y-5">
      <Link
        href="/leerlingen"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        ← Terug naar leerlingenlijst
      </Link>
      <h1 className="text-2xl font-bold text-slate-800">Nieuwe leerling</h1>
      <LeerlingForm klassen={klassen} />
    </div>
  );
}
