import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/lib/seedData";

const prisma = new PrismaClient();

// Lokaal seed-script: wist eerst alles (schone lei) en seedt dan opnieuw.
// De insert-logica zelf zit in src/lib/seedData.ts en wordt gedeeld met
// de productie-seed via /api/admin/seed (die niets verwijdert).
async function main() {
  console.log("🌱 Seeden van de database...");

  await prisma.verslag.deleteMany();
  await prisma.actie.deleteMany();
  await prisma.aviResultaat.deleteMany();
  await prisma.diagnose.deleteMany();
  await prisma.zorgprofiel.deleteMany();
  await prisma.leerling.deleteMany();
  await prisma.klas.deleteMany();
  await prisma.aviNormtabel.deleteMany();

  const res = await seedDatabase(prisma);
  console.log(
    `✅ ${res.klassen} klassen, ${res.leerlingen} leerlingen, ${res.normen} normtabel-rijen, ${res.verslagen} verslag(en)`
  );
  console.log("🎉 Seed voltooid!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
