// ============================================================================
//  Claude / Anthropic API integratie voor verslag-generatie
// ============================================================================
//
//  👉 HIER VUL JE JE EIGEN CLAUDE API KEY IN.
//
//  Zet in het bestand `.env` (in de root van dit project):
//
//      ANTHROPIC_API_KEY="sk-ant-..."
//      ANTHROPIC_MODEL="claude-sonnet-5"   (optioneel)
//
//  Zolang ANTHROPIC_API_KEY leeg is, gebruikt de app automatisch een lokale
//  MOCK-generator (mockVerslag hieronder), zodat je alles kan testen zónder key.
//  Van zodra je een geldige key invult, wordt de echte Claude API aangeroepen.
// ============================================================================

export interface VerslagContext {
  leerlingNaam: string;
  klas?: string;
  aanwezigen?: string;
  datum?: string;
}

export interface GegenereerdVerslag {
  verslag: string; // professioneel uitgeschreven verslag
  actiepunten: string; // lijst met actiepunten (als tekst, één per regel)
  opvolgdatum: string; // voorgestelde opvolgdatum in YYYY-MM-DD
  bron: "claude" | "mock"; // waar de output vandaan komt
}

const SYSTEM_PROMPT = `Je bent een ervaren zorgcoördinator in het Vlaamse lager onderwijs.
Je krijgt losse, informele notities van een oudergesprek of overleg over een leerling.
Zet deze om in een professioneel, helder en respectvol verslag in het Nederlands.
Blijf feitelijk, gebruik geen verzonnen informatie, en schrijf in een neutrale, professionele toon.
Formuleer concrete, haalbare actiepunten en stel een realistische opvolgdatum voor.`;

// Bouwt de instructie voor Claude, met de vraag om gestructureerde JSON terug te geven.
function buildUserPrompt(brontekst: string, ctx: VerslagContext): string {
  return `Leerling: ${ctx.leerlingNaam}${ctx.klas ? ` (klas ${ctx.klas})` : ""}
Datum gesprek: ${ctx.datum ?? "onbekend"}
Aanwezigen: ${ctx.aanwezigen ?? "onbekend"}

Losse notities:
"""
${brontekst}
"""

Geef je antwoord UITSLUITEND als geldige JSON met exact deze structuur:
{
  "verslag": "<professioneel uitgeschreven verslag als doorlopende tekst>",
  "actiepunten": "<actiepunten, één per regel, elk beginnend met '- '>",
  "opvolgdatum": "<voorgestelde opvolgdatum in formaat YYYY-MM-DD>"
}`;
}

// ---------------------------------------------------------------------------
//  Hoofd-functie: genereer een verslag uit losse notities.
// ---------------------------------------------------------------------------
export async function genereerVerslag(
  brontekst: string,
  ctx: VerslagContext
): Promise<GegenereerdVerslag> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  // Geen key ingevuld -> lokale mock, zodat de app zonder key testbaar blijft.
  if (!apiKey) {
    return mockVerslag(brontekst, ctx);
  }

  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(brontekst, ctx) }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Claude API fout ${res.status}: ${text}`);
    }

    const data = await res.json();
    const raw: string = data?.content?.[0]?.text ?? "";
    const parsed = parseJsonResponse(raw);

    return {
      verslag: parsed.verslag ?? raw,
      actiepunten: parsed.actiepunten ?? "",
      opvolgdatum: parsed.opvolgdatum ?? standaardOpvolgdatum(),
      bron: "claude",
    };
  } catch (err) {
    // Bij een fout (verkeerde key, netwerk, ...) valt de app terug op de mock,
    // met een duidelijke melding in het verslag.
    console.error("[claude] genereerVerslag mislukt:", err);
    const mock = mockVerslag(brontekst, ctx);
    return {
      ...mock,
      verslag:
        `⚠️ De Claude API-oproep is mislukt (${(err as Error).message}). ` +
        `Hieronder een lokaal gegenereerd concept:\n\n` +
        mock.verslag,
    };
  }
}

// Probeert JSON uit het antwoord te halen, ook als er tekst omheen staat.
function parseJsonResponse(raw: string): Partial<GegenereerdVerslag> {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* val door naar leeg object */
      }
    }
    return {};
  }
}

function standaardOpvolgdatum(): string {
  // Wordt bewust gebaseerd op de contextdatum via mock; hier een vaste fallback.
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
//  Lokale MOCK-generator (gebruikt zolang er geen API key is ingevuld).
//  Geen AI — enkel een nette sjabloonopbouw op basis van de ingevoerde notities.
// ---------------------------------------------------------------------------
function mockVerslag(brontekst: string, ctx: VerslagContext): GegenereerdVerslag {
  const zinnen = brontekst
    .split(/[\n.]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const inleiding =
    `Op ${ctx.datum ?? "de afgesproken datum"} vond een gesprek plaats over ` +
    `${ctx.leerlingNaam}${ctx.klas ? ` (klas ${ctx.klas})` : ""}. ` +
    `${ctx.aanwezigen ? `Aanwezig waren: ${ctx.aanwezigen}. ` : ""}` +
    `Tijdens het overleg werden de volgende punten besproken:`;

  const kern = zinnen.map((z) => `• ${z}.`).join("\n");

  const slot =
    `In onderling overleg werd afgesproken de situatie verder op te volgen ` +
    `en de gemaakte afspraken op de voorgestelde opvolgdatum te evalueren.`;

  const verslag = `${inleiding}\n\n${kern}\n\n${slot}`;

  // Simpele heuristiek voor actiepunten: neem zinnen met actie-signaalwoorden.
  const actieWoorden = /afspraak|afgesproken|opvolg|inzetten|contact|plannen|start|extra|oefenen|thuis/i;
  const gekozen = zinnen.filter((z) => actieWoorden.test(z));
  const actiepunten = (gekozen.length ? gekozen : zinnen.slice(0, 3))
    .map((z) => `- ${z}`)
    .join("\n");

  return {
    verslag,
    actiepunten: actiepunten || "- Situatie verder opvolgen",
    opvolgdatum: standaardOpvolgdatum(),
    bron: "mock",
  };
}
