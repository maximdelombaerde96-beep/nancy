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
2. **Oudergesprek opnemen**: neemt audio op via de **MediaRecorder API**, met
   tijdens het opnemen een optionele **snelle voorvertoning** (Web Speech). Na
   het stoppen wordt het audiofragment **rechtstreeks naar tijdelijke opslag**
   geüpload (met een **procentuele voortgangsindicator**), en start
   **AssemblyAI** een nauwkeurige transcriptie **mét sprekersherkenning**
   (speaker diarization, taal `nl`) op die URL. De client pollt de status en
   toont de voortgang. Het resultaat verschijnt met sprekerslabels
   (“Spreker A:”, “Spreker B:”) die je kan **hernoemen** (bv. “Ouder”,
   “Leerkracht”). Dit **AssemblyAI-transcript** is de definitieve tekst voor het
   verslag en voor “Laat AI uitwerken” — niet de live browser-voorvertoning.

   **Waarom directe upload?** De audio loopt **niet** door onze eigen serverless-
   route, zodat de Vercel-request-limiet (~4,5 MB) wegvalt en ook lange
   gesprekken/meetings (30–60+ min) volledig geüpload en getranscribeerd worden.
   De browser vraagt server-side een tijdelijk upload-doel op
   (**`POST /api/opname/upload-url`**) en uploadt daar rechtstreeks naartoe; onze
   `ASSEMBLYAI_API_KEY` blijft server-side en start enkel de transcriptie op de
   resulterende URL (**`POST /api/opname/transcript`** met `{ audioUrl }`), waarna
   de client **`GET /api/opname/transcript/[id]`** pollt.

   Opslag-modi (server-side gekozen): **Vercel Blob** (`BLOB_READ_WRITE_TOKEN`,
   client-upload met server-token via de **officiële `@vercel/blob/client`-flow**
   met `multipart: true`), een **generieke presigned PUT** (S3/R2 via
   `OPNAME_UPLOAD_ENDPOINT`), of — zonder beide — een **fallback** via de eigen
   route (tot ~4,5 MB). AssemblyAI biedt zelf geen client-upload-URL aan (hun
   `/v2/upload` vereist de key en levert een privé-URL), vandaar de tijdelijke
   opslag.

   **Robuuste upload (belangrijk voor gevoelige, lange gesprekken).** De upload is
   bestand tegen trage of haperende verbindingen (`src/lib/opnameUpload.ts`):
   - **Chunked/hervatbaar** — de generieke PUT gaat in stukken van 5 MB (`?part=N`,
     afgesloten met `?complete=M`); Vercel Blob gebruikt zijn eigen multipart. Een
     hapering herstart enkel het lopende stuk, niet de volledige upload.
   - **Retry met exponentiële backoff** — transiënte fouten (bv. **503**) worden
     automatisch opnieuw geprobeerd; de statustekst toont de nieuwe poging.
   - **Duidelijke foutmelding + retry-knop** — na uitputte pogingen blijft de UI
     **niet oneindig hangen** op “uploaden”, maar toont een fout met een
     **“Upload opnieuw proberen”**-knop.
   - **Nooit verloren** — de opname wordt lokaal (**IndexedDB**,
     `src/lib/opnameStore.ts`) bewaard tot **upload én transcriptie** bevestigd
     zijn. Bij wegklikken/navigeren tijdens de verwerking verschijnt een
     **`beforeunload`-waarschuwing**; een onafgewerkte opname toont bij terugkeer
     een **hervat-banner**. Na bevestigde transcriptie wordt de lokale kopie
     opgeruimd.

   🔒 **Privacy:** de audio staat **enkel tijdelijk** in de opslag tijdens de
   verwerking en wordt na de transcriptie **verwijderd**
   (**`POST /api/opname/cleanup`**); ze wordt **niet** in onze database bewaard.
   Enkel het **teksttranscript** wordt opgeslagen (als `Verslag.brontekst`, met
   leerling + datum). Je kan het audiofragment wél zelf lokaal downloaden
   (`.webm`).

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
| `ANTHROPIC_API_KEY`     | ⬜ optioneel | Claude API key voor verslag-generatie en “Laat AI uitwerken”. Leeg = mock / duidelijke melding. |
| `ANTHROPIC_MODEL`       | ⬜ optioneel | Welk Claude-model gebruikt wordt (default `claude-sonnet-5`).           |
| `ASSEMBLYAI_API_KEY`    | ⬜ optioneel | AssemblyAI key voor de nauwkeurige transcriptie (met sprekers) van opgenomen oudergesprekken. Leeg = duidelijke melding, geen audio verzonden. |
| `BLOB_READ_WRITE_TOKEN` | ⬜ optioneel | Voor **directe audio-upload** (lange opnames): maak een **Vercel Blob**-store aan (Storage → Blob) — dit wordt dan automatisch gezet. Aanbevolen; zonder dit valt de upload terug op de eigen route (~4,5 MB). |
| `OPNAME_UPLOAD_ENDPOINT`| ⬜ optioneel | Alternatief voor Blob: basis-URL van een generieke presigned-PUT-opslag (S3/R2/…). |

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
    aiVerslag.ts     # AI-uitwerking via @anthropic-ai/sdk (server-side)
    assemblyai.ts    # AssemblyAI-transcriptie met sprekers (server-side)
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
    api/ai/verslag/  # AI-uitwerking (Anthropic SDK)
    api/opname/      # transcriptie: upload-url, transcript, blob-upload, cleanup
```
