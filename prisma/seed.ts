import { PrismaClient } from "@prisma/client";
import { berekenAvi, parseToetsmoment, type AviNorm } from "../src/lib/avi";

const prisma = new PrismaClient();

const SCHOOLJAAR = "2025-2026";

// --- Voorbeeld-normtabel (fictief, vrij configureerbaar in de app) ---
// Per leerjaar + periode (M = midden, E = eind): verwacht niveau + grenzen.
const normen: AviNorm[] = [
  { leerjaar: 3, periode: "M", aviNiveau: "AVI-M3", tijdsgrens: 180, foutengrens: 8 },
  { leerjaar: 3, periode: "E", aviNiveau: "AVI-E3", tijdsgrens: 150, foutengrens: 6 },
  { leerjaar: 4, periode: "M", aviNiveau: "AVI-M4", tijdsgrens: 130, foutengrens: 6 },
  { leerjaar: 4, periode: "E", aviNiveau: "AVI-E4", tijdsgrens: 110, foutengrens: 5 },
  { leerjaar: 5, periode: "M", aviNiveau: "AVI-M5", tijdsgrens: 100, foutengrens: 5 },
  { leerjaar: 5, periode: "E", aviNiveau: "AVI-E5", tijdsgrens: 90, foutengrens: 4 },
];

function normFor(leerjaar: number, periode: string): AviNorm {
  const n = normen.find((x) => x.leerjaar === leerjaar && x.periode === periode);
  if (!n) throw new Error(`Geen norm voor leerjaar ${leerjaar} periode ${periode}`);
  return n;
}

// Bouwt een AVI-resultaat-record met berekend niveau + status.
function maakAvi(toetsmoment: string, datum: Date, leestijd: number, fouten: number) {
  const parsed = parseToetsmoment(toetsmoment)!;
  const norm = normFor(parsed.leerjaar, parsed.periode);
  const { aviNiveau, status } = berekenAvi(norm, leestijd, fouten);
  return {
    toetsmoment,
    datum,
    leestijdSeconden: leestijd,
    fouten,
    aviNiveau,
    status,
  };
}

async function main() {
  console.log("🌱 Seeden van de database...");

  // Schone lei
  await prisma.verslag.deleteMany();
  await prisma.actie.deleteMany();
  await prisma.aviResultaat.deleteMany();
  await prisma.diagnose.deleteMany();
  await prisma.zorgprofiel.deleteMany();
  await prisma.leerling.deleteMany();
  await prisma.klas.deleteMany();
  await prisma.aviNormtabel.deleteMany();

  // --- Normtabel ---
  await prisma.aviNormtabel.createMany({ data: normen });
  console.log(`✅ ${normen.length} normtabel-rijen aangemaakt`);

  // --- Klassen (2 klassen) ---
  const klas3A = await prisma.klas.create({
    data: { naam: "3A", leerjaar: 3, schooljaar: SCHOOLJAAR },
  });
  const klas4B = await prisma.klas.create({
    data: { naam: "4B", leerjaar: 4, schooljaar: SCHOOLJAAR },
  });
  console.log("✅ 2 klassen aangemaakt: 3A en 4B");

  // --- Leerlingen ---
  // Definieer per leerling de basisgegevens + optioneel zorgprofiel + AVI-resultaten.
  type LeerlingSeed = {
    voornaam: string;
    achternaam: string;
    geboortedatum: string;
    klasId: string;
    leerjaar: number;
    status: string;
    zorgprofiel?: {
      logo?: boolean;
      logoOmschrijving?: string;
      leersteun?: boolean;
      leersteunUren?: number;
      leersteunType?: string;
      zorgmaatregelen?: string;
      diagnoses?: { type: string; datum: string; bron: string }[];
    };
    avi: { moment: string; datum: string; leestijd: number; fouten: number }[];
  };

  const leerlingen: LeerlingSeed[] = [
    // ---- Klas 3A (leerjaar 3) ----
    {
      voornaam: "Emma",
      achternaam: "Peeters",
      geboortedatum: "2017-03-12",
      klasId: klas3A.id,
      leerjaar: 3,
      status: "geen",
      avi: [
        { moment: "M3", datum: "2026-01-15", leestijd: 120, fouten: 3 },
      ],
    },
    {
      voornaam: "Noah",
      achternaam: "Janssens",
      geboortedatum: "2017-06-04",
      klasId: klas3A.id,
      leerjaar: 3,
      status: "verhoogde_zorg",
      zorgprofiel: {
        logo: true,
        logoOmschrijving: "Logopedie voor articulatie (/r/ en /s/).",
        leersteun: false,
        zorgmaatregelen: "Extra leestijd, voorlezen van instructies.",
        diagnoses: [
          { type: "Articulatiestoornis", datum: "2024-09-20", bron: "Logopedist" },
        ],
      },
      avi: [
        { moment: "M3", datum: "2026-01-15", leestijd: 200, fouten: 10 },
      ],
    },
    {
      voornaam: "Olivia",
      achternaam: "Maes",
      geboortedatum: "2017-01-28",
      klasId: klas3A.id,
      leerjaar: 3,
      status: "geen",
      avi: [
        { moment: "M3", datum: "2026-01-15", leestijd: 95, fouten: 1 },
      ],
    },
    {
      voornaam: "Lucas",
      achternaam: "Willems",
      geboortedatum: "2017-08-17",
      klasId: klas3A.id,
      leerjaar: 3,
      status: "uitbreiding_zorg",
      zorgprofiel: {
        logo: false,
        leersteun: true,
        leersteunUren: 2,
        leersteunType: "Lezen & spelling",
        zorgmaatregelen: "Wekelijkse leessessies met leersteuncoach. Gebruik van leeslineaal.",
        diagnoses: [
          { type: "Dyslexie (vermoeden)", datum: "2025-11-10", bron: "CLB" },
        ],
      },
      avi: [
        { moment: "M3", datum: "2026-01-15", leestijd: 240, fouten: 14 },
      ],
    },
    {
      voornaam: "Mila",
      achternaam: "Claes",
      geboortedatum: "2017-05-09",
      klasId: klas3A.id,
      leerjaar: 3,
      status: "geen",
      avi: [
        { moment: "M3", datum: "2026-01-15", leestijd: 150, fouten: 5 },
      ],
    },
    {
      voornaam: "Finn",
      achternaam: "Wouters",
      geboortedatum: "2017-11-22",
      klasId: klas3A.id,
      leerjaar: 3,
      status: "verhoogde_zorg",
      zorgprofiel: {
        logo: true,
        logoOmschrijving: "Logopedie voor fonologische vaardigheden.",
        leersteun: true,
        leersteunUren: 1,
        leersteunType: "Fonologisch bewustzijn",
        zorgmaatregelen: "Kleine stappen, veel herhaling.",
        diagnoses: [],
      },
      avi: [
        { moment: "M3", datum: "2026-01-15", leestijd: 185, fouten: 9 },
      ],
    },

    // ---- Klas 4B (leerjaar 4) ----
    {
      voornaam: "Louise",
      achternaam: "Vermeulen",
      geboortedatum: "2016-02-14",
      klasId: klas4B.id,
      leerjaar: 4,
      status: "geen",
      avi: [
        { moment: "E3", datum: "2025-06-10", leestijd: 130, fouten: 4 },
        { moment: "M4", datum: "2026-01-16", leestijd: 105, fouten: 3 },
      ],
    },
    {
      voornaam: "Adam",
      achternaam: "De Smet",
      geboortedatum: "2016-07-30",
      klasId: klas4B.id,
      leerjaar: 4,
      status: "individueel",
      zorgprofiel: {
        logo: false,
        leersteun: true,
        leersteunUren: 3,
        leersteunType: "Lezen (individueel traject)",
        zorgmaatregelen:
          "Individueel aangepast curriculum voor lezen. Voorleessoftware toegestaan bij toetsen.",
        diagnoses: [
          { type: "Dyslexie", datum: "2025-03-05", bron: "Klinisch psycholoog" },
          { type: "ADHD", datum: "2024-10-12", bron: "Kinderpsychiater" },
        ],
      },
      avi: [
        { moment: "E3", datum: "2025-06-10", leestijd: 210, fouten: 12 },
        { moment: "M4", datum: "2026-01-16", leestijd: 175, fouten: 9 },
      ],
    },
    {
      voornaam: "Nora",
      achternaam: "Aerts",
      geboortedatum: "2016-04-03",
      klasId: klas4B.id,
      leerjaar: 4,
      status: "geen",
      avi: [
        { moment: "E3", datum: "2025-06-10", leestijd: 90, fouten: 2 },
        { moment: "M4", datum: "2026-01-16", leestijd: 80, fouten: 1 },
      ],
    },
    {
      voornaam: "Liam",
      achternaam: "Goossens",
      geboortedatum: "2016-09-19",
      klasId: klas4B.id,
      leerjaar: 4,
      status: "verhoogde_zorg",
      zorgprofiel: {
        logo: true,
        logoOmschrijving: "Logopedie voor begrijpend lezen en woordenschat.",
        leersteun: false,
        zorgmaatregelen: "Pre-teaching van moeilijke woorden.",
        diagnoses: [
          { type: "Taalontwikkelingsstoornis (TOS)", datum: "2023-05-18", bron: "Logopedist" },
        ],
      },
      avi: [
        { moment: "E3", datum: "2025-06-10", leestijd: 160, fouten: 7 },
        { moment: "M4", datum: "2026-01-16", leestijd: 140, fouten: 7 },
      ],
    },
    {
      voornaam: "Ella",
      achternaam: "Michiels",
      geboortedatum: "2016-12-01",
      klasId: klas4B.id,
      leerjaar: 4,
      status: "geen",
      avi: [
        { moment: "E3", datum: "2025-06-10", leestijd: 115, fouten: 3 },
        { moment: "M4", datum: "2026-01-16", leestijd: 100, fouten: 2 },
      ],
    },
    {
      voornaam: "Victor",
      achternaam: "Hermans",
      geboortedatum: "2016-06-25",
      klasId: klas4B.id,
      leerjaar: 4,
      status: "uitbreiding_zorg",
      zorgprofiel: {
        logo: false,
        leersteun: true,
        leersteunUren: 2,
        leersteunType: "Lezen & begrijpend lezen",
        zorgmaatregelen: "Wekelijkse opvolging, leescontract met haalbare doelen.",
        diagnoses: [{ type: "Leesachterstand", datum: "2025-09-30", bron: "Zorgcoördinator" }],
      },
      avi: [
        { moment: "E3", datum: "2025-06-10", leestijd: 190, fouten: 10 },
        { moment: "M4", datum: "2026-01-16", leestijd: 155, fouten: 8 },
      ],
    },
  ];

  for (const l of leerlingen) {
    const leerling = await prisma.leerling.create({
      data: {
        voornaam: l.voornaam,
        achternaam: l.achternaam,
        geboortedatum: new Date(l.geboortedatum),
        klasId: l.klasId,
        leerjaar: l.leerjaar,
        schooljaar: SCHOOLJAAR,
        status: l.status,
        zorgprofiel: l.zorgprofiel
          ? {
              create: {
                logo: l.zorgprofiel.logo ?? false,
                logoOmschrijving: l.zorgprofiel.logoOmschrijving ?? "",
                leersteun: l.zorgprofiel.leersteun ?? false,
                leersteunUren: l.zorgprofiel.leersteunUren ?? 0,
                leersteunType: l.zorgprofiel.leersteunType ?? "",
                zorgmaatregelen: l.zorgprofiel.zorgmaatregelen ?? "",
                diagnoses: {
                  create: (l.zorgprofiel.diagnoses ?? []).map((d) => ({
                    type: d.type,
                    datum: new Date(d.datum),
                    bron: d.bron,
                  })),
                },
              },
            }
          : undefined,
        aviResultaten: {
          create: l.avi.map((a) =>
            maakAvi(a.moment, new Date(a.datum), a.leestijd, a.fouten)
          ),
        },
      },
    });

    // Voorbeeld-actie voor leerlingen met zorg
    if (l.status !== "geen") {
      await prisma.actie.create({
        data: {
          leerlingId: leerling.id,
          type: "notitie",
          tekst: `Zorgtraject opgestart voor ${l.voornaam}. Opvolging via leessessies en overleg met ouders.`,
          opvolgdatum: new Date("2026-03-01"),
          auteur: "Zorgcoördinator",
        },
      });
    }
  }

  console.log(`✅ ${leerlingen.length} leerlingen aangemaakt (met AVI-resultaten en zorgprofielen)`);

  // Voorbeeldverslag bij Adam De Smet
  const adam = await prisma.leerling.findFirst({
    where: { voornaam: "Adam", achternaam: "De Smet" },
  });
  if (adam) {
    await prisma.verslag.create({
      data: {
        leerlingId: adam.id,
        datum: new Date("2026-02-05"),
        aanwezigen: "Ouders, klasleerkracht, zorgcoördinator",
        brontekst:
          "Ouders bezorgd over huiswerk. Adam is snel afgeleid. Leest thuis niet graag. Voorleessoftware helpt. Afspraak: dagelijks 10 min samen lezen.",
        gegenereerdVerslag:
          "Tijdens het oudergesprek werd de leesontwikkeling van Adam besproken. De ouders uitten hun bezorgdheid rond het huiswerk en de concentratie. Er werd vastgesteld dat voorleessoftware een positief effect heeft. In onderling overleg werden concrete afspraken gemaakt om het lezen thuis te ondersteunen.",
        actiepunten:
          "- Dagelijks 10 minuten samen lezen thuis\n- Voorleessoftware verder inzetten bij toetsen\n- Concentratie opvolgen i.s.m. kinderpsychiater",
        opvolgdatum: new Date("2026-04-01"),
      },
    });
    console.log("✅ Voorbeeldverslag aangemaakt voor Adam De Smet");
  }

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
