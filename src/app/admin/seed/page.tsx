import { prisma } from "@/lib/prisma";
import SeedButton from "./SeedButton";

export const dynamic = "force-dynamic";

export default async function AdminSeedPage() {
  const aantal = await prisma.leerling.count();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Database vullen met testdata
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Eenmalige actie om de (lege) database te vullen met fictieve testdata.
          Deze knop is enkel bereikbaar als je ingelogd bent, en de seed weigert
          te draaien zodra er al leerlingen in de database staan.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-4 text-sm text-slate-600">
          Huidige inhoud:{" "}
          <span className="font-semibold text-slate-800">
            {aantal} leerling{aantal === 1 ? "" : "en"}
          </span>{" "}
          in de database.
        </p>
        <SeedButton alGevuld={aantal > 0} />
      </div>

      <p className="text-xs text-slate-400">
        ⚠️ De testdata is volledig fictief. Draai dit niet op een database met
        echte gegevens.
      </p>
    </div>
  );
}
