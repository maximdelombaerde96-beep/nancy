import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { seedDatabase } from "@/lib/seedData";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

// Deze route mag nooit statisch gecached worden.
export const dynamic = "force-dynamic";

// Defensieve auth-check (naast de middleware): laat enkel ingelogde gebruikers
// toe. Staat het poortje uit (geen APP_PASSWORD), dan is dit een lokale/dev
// situatie en laten we het toe.
async function isIngelogd(): Promise<boolean> {
  const expected = await expectedToken();
  if (!expected) return true;
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value === expected;
}

// Eenmalige seed op productie. Weigert als er al leerlingen zijn, zodat er
// nooit bestaande (echte) data overschreven wordt.
export async function POST() {
  if (!(await isIngelogd())) {
    return NextResponse.json(
      { ok: false, message: "Niet ingelogd." },
      { status: 401 }
    );
  }

  const bestaand = await prisma.leerling.count();
  if (bestaand > 0) {
    return NextResponse.json(
      {
        ok: false,
        message: `Database bevat al ${bestaand} leerling(en). Seed geweigerd om bestaande data niet te overschrijven.`,
        aantalLeerlingen: bestaand,
      },
      { status: 409 }
    );
  }

  try {
    const res = await seedDatabase(prisma);
    return NextResponse.json({
      ok: true,
      message: "Seed voltooid.",
      ...res,
    });
  } catch (err) {
    console.error("[seed] mislukt:", err);
    return NextResponse.json(
      { ok: false, message: `Seed mislukt: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
