import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";
import { werkVerslagUit, GeenApiKeyError } from "@/lib/aiVerslag";

export const dynamic = "force-dynamic";
// Geef ruimte voor de AI-oproep op Vercel (serverless).
export const maxDuration = 60;

// Defensieve auth-check naast de middleware: enkel ingelogde gebruikers.
// Staat het poortje uit (geen APP_PASSWORD), dan is dit een lokale/dev situatie.
async function isIngelogd(): Promise<boolean> {
  const expected = await expectedToken();
  if (!expected) return true;
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value === expected;
}

function fout(status: number, message: string) {
  return NextResponse.json({ ok: false, message }, { status });
}

// Werkt ruwe brontekst (dictaat/transcript) uit tot een net verslag.
export async function POST(req: Request) {
  if (!(await isIngelogd())) {
    return fout(401, "Niet ingelogd.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fout(400, "Ongeldige aanvraag.");
  }

  const tekst = String((body as { tekst?: unknown })?.tekst ?? "").trim();
  if (!tekst) {
    return fout(400, "Er is geen tekst om uit te werken.");
  }

  try {
    const uitgewerkt = await werkVerslagUit(tekst);
    return NextResponse.json({ ok: true, tekst: uitgewerkt });
  } catch (err) {
    // Nette, specifieke foutmeldingen — de originele tekst blijft client-side behouden.
    if (err instanceof GeenApiKeyError) {
      return fout(
        503,
        "Geen Claude API key ingesteld. Voeg ANTHROPIC_API_KEY toe in de environment variables."
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return fout(401, "Ongeldige Claude API key.");
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      return fout(403, "Geen toegang met deze Claude API key.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      return fout(429, "Rate limit bereikt bij de Claude API. Probeer straks opnieuw.");
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return fout(502, "Kon de Claude API niet bereiken (netwerkfout). Probeer opnieuw.");
    }
    if (err instanceof Anthropic.APIError) {
      return fout(
        err.status && err.status >= 400 ? err.status : 502,
        `Claude API-fout: ${err.message}`
      );
    }
    console.error("[ai/verslag] onverwachte fout:", err);
    return fout(500, `Onverwachte fout: ${(err as Error).message}`);
  }
}
