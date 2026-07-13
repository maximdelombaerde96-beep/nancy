// ============================================================================
//  Eenvoudige applicatiebrede wachtwoordbeveiliging ("poortje")
// ============================================================================
//
//  Eén gedeeld wachtwoord via de environment variable APP_PASSWORD.
//  - Is APP_PASSWORD leeg/niet ingesteld -> het poortje staat UIT (open toegang).
//    Handig voor lokale ontwikkeling; op Vercel stel je APP_PASSWORD in om het
//    poortje AAN te zetten.
//  - De sessiecookie bevat niet het wachtwoord zelf, maar een SHA-256 afgeleide
//    ervan. Zo staat het wachtwoord nooit in de cookie.
//
//  Deze helper gebruikt de Web Crypto API (crypto.subtle), zodat hij zowel in
//  de Edge-middleware als in server-actions (Node) werkt — belangrijk voor een
//  serverless Vercel-deployment.
// ============================================================================

export const AUTH_COOKIE = "app_auth";

// Staat het poortje aan? (d.w.z. is er een wachtwoord ingesteld)
export function gateEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD && process.env.APP_PASSWORD.length > 0);
}

// Leidt een sessietoken af uit het wachtwoord (SHA-256, hex).
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`zorgdossier:v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Het verwachte tokenwaarde-in-de-cookie voor het huidige wachtwoord,
// of null als het poortje uitstaat.
export async function expectedToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  return sessionToken(pw);
}

// Zorgt dat een redirect-pad intern is (voorkomt open-redirect).
export function veiligPad(pad: string | undefined | null): string {
  if (!pad) return "/";
  if (pad.startsWith("/") && !pad.startsWith("//")) return pad;
  return "/";
}
