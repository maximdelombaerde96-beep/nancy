import Anthropic from "@anthropic-ai/sdk";

// ============================================================================
//  Server-side AI-uitwerking van ruwe brontekst (dictaat / oudergesprek-
//  transcript) tot een net, gestructureerd verslag via de Anthropic API.
//
//  De API key (ANTHROPIC_API_KEY) wordt UITSLUITEND server-side gebruikt en
//  komt nooit bij de client terecht. Model is configureerbaar via
//  ANTHROPIC_MODEL (standaard: de nieuwste Sonnet).
// ============================================================================

// Fout die aangeeft dat er geen API key is ingesteld.
export class GeenApiKeyError extends Error {
  constructor() {
    super("Geen Claude API key ingesteld (ANTHROPIC_API_KEY).");
    this.name = "GeenApiKeyError";
  }
}

const SYSTEM_PROMPT = `Je bent een ervaren leerlingbegeleider (zorgcoördinator) in het Vlaamse lager onderwijs.
Je krijgt ruwe, gesproken tekst: losse dicteernotities of een transcript van een oudergesprek/overleg over een leerling.

Je taak: herschrijf die ruwe tekst tot een professioneel, neutraal en duidelijk verslag in correcte, volledige zinnen.

Strikte regels:
- Behoud ALLE feitelijke inhoud en details uit de brontekst. Laat niets weg.
- Verzin NIETS bij: voeg geen feiten, namen, data, diagnoses of afspraken toe die niet in de brontekst staan. Bij twijfel: laat het zoals het is.
- Structureer waar zinvol met duidelijke alinea's, bijvoorbeeld: aanleiding/context, gespreksverloop en observaties, en afspraken/vervolgstappen. Gebruik geen structuur die niet door de inhoud gedekt wordt.
- Gebruik gepaste, respectvolle en professionele taal — dit is een dossier over een minderjarige. Vermijd oordelen; beschrijf feitelijk en beroepsmatig.
- Corrigeer spreektaal, herhalingen en onafgemaakte zinnen tot vlot lopend Nederlands, maar verander de betekenis niet.
- Antwoord UITSLUITEND met het uitgewerkte verslag zelf, zonder inleiding, aanhef, commentaar of markdown-codeblokken.`;

function buildUserPrompt(brontekst: string): string {
  return `Werk de volgende ruwe tekst uit tot een net verslag volgens de regels:

"""
${brontekst}
"""`;
}

// Type dat volstaat voor zowel de echte client als een test-mock.
type MessagesClient = Pick<Anthropic, "messages">;

// Werkt de brontekst uit tot een net verslag. Gooit GeenApiKeyError als er geen
// key is, of een Anthropic.* fout bij API-problemen (rate limit, auth, netwerk).
export async function werkVerslagUit(
  brontekst: string,
  opts?: { client?: MessagesClient }
): Promise<string> {
  const tekst = brontekst.trim();
  if (!tekst) return "";

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey && !opts?.client) {
    throw new GeenApiKeyError();
  }

  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5";
  const client: MessagesClient = opts?.client ?? new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    // Snelle, directe herformulering — geen uitgebreid redeneren nodig.
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(tekst) }],
  });

  const uitgewerkt = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return uitgewerkt;
}
