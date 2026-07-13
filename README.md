# Zorgdossier Tool (MVP)

Een webapplicatie voor een **zorgcoördinator in het lager onderwijs**.
Stack: **Next.js + TypeScript + PostgreSQL (via Prisma) + Tailwind CSS**.
Optioneel afschermbaar met één gedeeld wachtwoord. Werkt met **fictieve
testdata** (geen echte leerlingen).

> ⚠️ Dit is een MVP-prototype. Alle data is verzonnen.

## Snel starten (lokaal)

Je hebt een lokale **PostgreSQL** nodig. Zet in `.env` de `DATABASE_URL` en
`DATABASE_URL_UNPOOLED` (zie `.env` voor een voorbeeld), en dan:

```bash
npm install          # dependencies + genereert Prisma client
npm run db:migrate    # past de migraties toe op je database
npm run db:seed       # vult de database met fictieve testdata
npm run dev           # start op http://localhost:3000
```

Of in één keer opnieuw opzetten: `npm run db:reset` (dropt, migreert én seedt).

Handige scripts:

| Script               | Wat het doet                                          |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | Start de dev-server (http://localhost:3000)           |
| `npm run db:migrate` | Maakt/past migraties toe (`prisma migrate dev`)       |
| `npm run db:deploy`  | Past bestaande migraties toe (`prisma migrate deploy`)|
| `npm run db:reset`   | Dropt de db, herbouwt via migraties + seed            |
| `npm run db:seed`    | Enkel (opnieuw) seeden                                |
| `npm run db:studio`  | Opent Prisma Studio om de database te bekijken        |
| `npm run build`      | `prisma generate` + `prisma migrate deploy` + build   |

## Functionaliteiten

- **Dashboard** (`/dashboard`) — filter leerlingen op klas, leerjaar, zorgstatus, **AVI-status** (onder/op/boven niveau), **logopedie**, **leersteun** en **type diagnose**; overzichtstabel met directe link naar het dossier en een korte samenvatting.
- **Leerlingenlijst** (`/leerlingen`) — met zoeken (naam) en filteren op klas, leerjaar en zorgstatus. Volledige **CRUD**: leerling aanmaken, bewerken, **archiveren/herstellen** en definitief verwijderen — allemaal via de UI.
- **Opvolgacties** (`/opvolging`) — alle acties met een opvolgdatum, gesorteerd op vervaldatum, met status **open/afgerond** en filter op **verlopen / binnenkort (≤ 14 dagen) / later** en per leerling.
- **Dossier** (`/leerlingen/[id]`) — alles op één scherm. Het **zorgprofiel is volledig bewerkbaar** (logopedie, leersteun, diagnoses toevoegen/bewerken/verwijderen, zorgmaatregelen). **AVI-evolutiegrafiek** + tijdlijn, acties/notities (met opvolgstatus) en verslagen; zorgstatus direct aanpasbaar. **Print / PDF-export** van het volledige dossier (`/leerlingen/[id]/print`) en van een verslag via de browser ("Opslaan als PDF").
- **AVI-module** (`/avi`) — je vult enkel **leestijd + fouten** in; de tool berekent automatisch het **AVI-niveau** en de **status** (onder/op/boven niveau) op basis van de normtabel, en toont een **klasoverzicht**.
- **Normtabel** (`/normtabel`) — configureerbaar scherm voor de AVI-grenzen per leerjaar/periode.
- **Verslag-module** (`/leerlingen/[id]/verslag/nieuw`) — typ losse notities (of **dicteer** ze met de microfoon-knop, of laat ze door **AI uitwerken** tot een net verslag) → laat er een professioneel verslag met actiepunten + opvolgdatum van maken → beoordeel/pas aan → sla op bij de leerling.
- **Oudergesprek opnemen** (`/leerlingen/[id]/opname`, ook bereikbaar vanuit het dashboard) — neem een gesprek op en bouw tegelijk een **live transcript** op. Na het stoppen corrigeer je het transcript en maak je er een verslag van. Zie *Spraakfunctionaliteit* hieronder.

## Spraakfunctionaliteit (browser-native, gratis)

Beide functies gebruiken de **Web Speech API** (`SpeechRecognition`) — geen
externe API of key nodig. Werkt in **Chrome/Edge**; niet in Safari/Firefox
(daar tonen de knoppen netjes de melding "gebruik Chrome"). Taal: probeert
`nl-BE`, valt terug op `nl-NL`.

1. **Dicteren** bij een verslag: een microfoon-knop bij het notitieveld die
   live spraak → tekst omzet en aanvult terwijl je spreekt (knop pulseert rood
   tijdens het luisteren).
2. **Oudergesprek opnemen**: neemt audio op via de **MediaRecorder API** én
   bouwt tegelijk een live transcript op. Na het stoppen kan je het transcript
   corrigeren en met één klik overnemen als basis voor een nieuw verslag.

   🔒 **Privacy:** enkel het **transcript (tekst)** wordt bewaard (als
   `Verslag.brontekst`, met leerling + datum). Het **audiofragment gaat nooit
   naar de server/database** — je kan het wél zelf lokaal downloaden (`.webm`).

## Claude API (AI-functies)

Er zijn twee AI-functies, beide server-side (de API key komt **nooit** bij de client):

1. **Verslag genereren** (`src/lib/claude.ts`, functie `genereerVerslag`) — zet losse
   notities om in een verslag met actiepunten + opvolgdatum. Werkt **zonder key** dankzij
   een lokale **mock-generator**; met een key gebruikt ze de echte Claude API.
2. **"Laat AI uitwerken"** — knop naast de dicteerknop (in de verslag-editor én het
   oudergesprek-scherm) die de ruwe tekst (dictaat/transcript) via de **officiële
   `@anthropic-ai/sdk`** herschrijft tot een net, gestructureerd verslag. Dit loopt via de
   server-route **`POST /api/ai/verslag`** (`src/lib/aiVerslag.ts`), met een systeemprompt
   voor een leerlingbegeleider in het Vlaamse onderwijs (behoudt alle feiten, verzint niets,
   structureert met duidelijke alinea's). Bij succes vervangt het resultaat de tekst in het
   veld, met **"Ongedaan maken"** om de originele tekst terug te zetten; bij een fout (geen
   key, rate limit, netwerk) blijft de originele tekst behouden en verschijnt een nette melding.

Vul je key in via de environment variables:

```env
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-sonnet-5"   # optioneel; standaard de nieuwste Sonnet
```

Zonder `ANTHROPIC_API_KEY` valt functie 1 terug op de mock; functie 2 toont dan de melding
dat er geen key is ingesteld (er wordt niets naar Claude gestuurd).

## Wachtwoordbeveiliging (poortje)

De hele app kan achter één gedeeld wachtwoord gezet worden via de environment
variable **`APP_PASSWORD`**:

- **Leeg / niet ingesteld** → poortje **uit** (open toegang; handig lokaal).
- **Waarde ingesteld** → poortje **aan**: bezoekers krijgen eerst een
  inlogpagina (`/login`). Na het juiste wachtwoord wordt een `httpOnly`-cookie
  gezet (met een SHA-256 afgeleide van het wachtwoord, niet het wachtwoord zelf).
  Een **Afmelden**-knop wist de sessie.

De afscherming gebeurt in `src/middleware.ts` (Edge middleware — werkt ook in
Vercels serverless omgeving). Statische bestanden en de inlogpagina blijven
bereikbaar. Zie het deployment-hoofdstuk voor het instellen op Vercel.

## Deployment op Vercel

De app draait op Vercel (serverless). Omdat het serverless filesystem
read-only is, gebruikt de app **PostgreSQL** (niet langer een lokaal
SQLite-bestand). Deze setup is afgestemd op de **Neon-Postgres-integratie** in
Vercel.

### Environment variables (in Vercel → Project → Settings → Environment Variables)

De Neon-integratie maakt `DATABASE_URL` en `DATABASE_URL_UNPOOLED` **automatisch**
aan — die hoef je niet zelf over te typen. Je voegt enkel `APP_PASSWORD` (en
optioneel de Claude-variabelen) toe.

| Variabele               | Verplicht | Waarvoor                                                                 |
| ----------------------- | --------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`          | ✅ (auto) | Pooled connectiestring voor de app. **Automatisch gezet door de Neon-integratie.** |
| `DATABASE_URL_UNPOOLED` | ✅ (auto) | Directe (niet-pooled) connectiestring, gebruikt door `prisma migrate deploy` tijdens de build. **Automatisch gezet door de Neon-integratie.** |
| `APP_PASSWORD`          | ✅ ja*    | Het gedeelde wachtwoord voor het inlog-poortje. *Technisch optioneel — laat je het leeg, dan is de site publiek toegankelijk.* Zet het dus zeker bij een live-deploy. |
| `ANTHROPIC_API_KEY`     | ⬜ optioneel | Claude API key voor de verslag-generatie. Leeg = lokale mock-generator. |
| `ANTHROPIC_MODEL`       | ⬜ optioneel | Welk Claude-model gebruikt wordt (default `claude-sonnet-5`).           |

Gebruik je een andere provider dan Neon, zorg dan zelf dat `DATABASE_URL`
(pooled) en `DATABASE_URL_UNPOOLED` (direct) gezet zijn; heb je maar één URL,
zet dan dezelfde waarde in beide.

### Migraties

Het build-commando is `prisma generate && prisma migrate deploy && next build`,
dus **bij elke deploy worden de migraties automatisch uitgevoerd** tegen de
database uit `DATABASE_URL_UNPOOLED`. Er is geen extra stap nodig.

### Database eenmalig vullen met testdata (seed)

**Aanbevolen (via de browser, geen geheimen nodig):** log in op de live app en
ga naar **`/admin/seed`**. Die pagina toont een knop "Testdata plaatsen".
Onderliggend roept ze de beveiligde route `POST /api/admin/seed` aan, die:

- enkel werkt voor een **ingelogde** gebruiker (via het bestaande poortje +
  een extra auth-check in de route zelf), en
- **weigert** te draaien zodra er al leerlingen in de database staan (geen
  risico dat echte data overschreven wordt).

Zo hoef je geen productie-connectiestring lokaal te gebruiken.

**Alternatief (lokaal script):** wil je toch vanaf je eigen machine seeden, dan
kan het klassieke script — let op: dit **verwijdert eerst alle bestaande data**
en is dus enkel voor een initiële vulling:

```bash
DATABASE_URL="<neon-pooled-url>" DATABASE_URL_UNPOOLED="<neon-direct-url>" npm run db:seed
```

## Datamodel

Zie [`prisma/schema.prisma`](prisma/schema.prisma): `Klas`, `Leerling`, `Zorgprofiel` (1-op-1),
`Diagnose`, `AviResultaat`, `AviNormtabel`, `Actie`, `Verslag`.

## Projectstructuur

```
prisma/
  schema.prisma      # datamodel (PostgreSQL)
  migrations/        # Prisma-migraties (uitgevoerd bij de build)
  seed.ts            # 12 fictieve leerlingen, 2 klassen, AVI-resultaten, normtabel
src/
  middleware.ts      # wachtwoord-poortje (Edge middleware)
  lib/
    prisma.ts        # Prisma client
    auth.ts          # wachtwoordbeveiliging (Web Crypto)
    avi.ts           # AVI-berekening (niveau + status) + grafiekschaal
    opvolging.ts     # urgentie-classificatie van opvolgacties
    seedData.ts      # gedeelde seed-inserts (script + /api/admin/seed)
    claude.ts        # 👈 Claude API-integratie + mock (hier je key)
    format.ts        # weergave-helpers
  components/        # NavBar, Badge, PrintButton, AfgerondToggle
  app/
    login/           # inlogpagina + login/logout-actions
    dashboard/       # dashboard met filters
    leerlingen/      # lijst, CRUD, dossier, acties, verslag- en print-weergave
    opvolging/       # opvolgacties-overzicht
    avi/             # AVI-invoer + klasoverzicht
    normtabel/       # normtabel-configuratie
    admin/seed/      # beveiligde pagina om eenmalig te seeden
    api/admin/seed/  # beveiligde POST-route (auth + guard op bestaande data)
```
