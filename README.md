# Zorgdossier Tool (MVP)

Een lokale webapplicatie voor een **zorgcoördinator in het lager onderwijs**.
Volledig lokaal draaiend: **Next.js + TypeScript + SQLite (via Prisma) + Tailwind CSS**.
Geen externe backend, geen login. Werkt met **fictieve testdata** (geen echte leerlingen).

> ⚠️ Dit is een MVP-prototype. Alle data is verzonnen.

## Snel starten

```bash
npm install          # dependencies + genereert Prisma client
npm run db:reset     # maakt de SQLite-db aan en vult ze met fictieve testdata
npm run dev          # start op http://localhost:3000
```

Handige scripts:

| Script              | Wat het doet                                         |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start de dev-server (http://localhost:3000)          |
| `npm run db:reset`  | Wist en herbouwt de database + seed-data             |
| `npm run db:seed`   | Enkel (opnieuw) seeden                               |
| `npm run db:studio` | Opent Prisma Studio om de database te bekijken       |
| `npm run build`     | Productie-build (tevens volledige type-check)        |

## Functionaliteiten

- **Dashboard** (`/dashboard`) — filter leerlingen op klas, leerjaar, zorgstatus, **AVI-status** (onder/op/boven niveau), **logopedie**, **leersteun** en **type diagnose**; overzichtstabel met directe link naar het dossier en een korte samenvatting.
- **Leerlingenlijst** (`/leerlingen`) — met zoeken (naam) en filteren op klas, leerjaar en zorgstatus. Volledige **CRUD**: leerling aanmaken, bewerken, **archiveren/herstellen** en definitief verwijderen — allemaal via de UI.
- **Dossier** (`/leerlingen/[id]`) — alles op één scherm. Het **zorgprofiel is volledig bewerkbaar** (logopedie, leersteun, diagnoses toevoegen/bewerken/verwijderen, zorgmaatregelen). AVI-tijdlijn, acties/notities en verslagen; zorgstatus direct aanpasbaar.
- **AVI-module** (`/avi`) — je vult enkel **leestijd + fouten** in; de tool berekent automatisch het **AVI-niveau** en de **status** (onder/op/boven niveau) op basis van de normtabel, en toont een **klasoverzicht**.
- **Normtabel** (`/normtabel`) — configureerbaar scherm voor de AVI-grenzen per leerjaar/periode.
- **Verslag-module** (`/leerlingen/[id]/verslag/nieuw`) — typ losse notities → laat er een professioneel verslag met actiepunten + opvolgdatum van maken → beoordeel/pas aan → sla op bij de leerling.

## Claude API key invullen (verslag-generatie)

De verslag-module werkt **zonder key** dankzij een lokale **mock-generator** — zo kun je alles testen.
Wil je de echte AI-generatie via Claude? Vul dan je key in `.env` in:

```env
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-sonnet-5"   # optioneel
```

De integratie zit volledig in **`src/lib/claude.ts`** (functie `genereerVerslag`). Zolang de key
leeg is, gebruikt de app automatisch de mock; van zodra er een geldige key staat, roept ze de
echte Claude Messages API aan. Faalt de API-oproep (bv. verkeerde key), dan valt de app netjes
terug op de mock met een duidelijke melding.

## Datamodel

Zie [`prisma/schema.prisma`](prisma/schema.prisma): `Klas`, `Leerling`, `Zorgprofiel` (1-op-1),
`Diagnose`, `AviResultaat`, `AviNormtabel`, `Actie`, `Verslag`.

## Projectstructuur

```
prisma/
  schema.prisma      # datamodel
  seed.ts            # 12 fictieve leerlingen, 2 klassen, AVI-resultaten, normtabel
src/
  lib/
    prisma.ts        # Prisma client
    avi.ts           # AVI-berekening (niveau + status)
    claude.ts        # 👈 Claude API-integratie + mock (hier je key)
    format.ts        # weergave-helpers
  components/        # NavBar, Badge
  app/
    leerlingen/      # lijst, dossier, acties, verslag-module
    avi/             # AVI-invoer + klasoverzicht
    normtabel/       # normtabel-configuratie
```
