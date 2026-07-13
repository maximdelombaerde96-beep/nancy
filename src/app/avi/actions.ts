"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { berekenAvi, parseToetsmoment, type AviNorm } from "@/lib/avi";

export interface AviActionResult {
  ok: boolean;
  message: string;
  aviNiveau?: string;
  status?: string;
}

// Registreer een nieuw AVI-resultaat.
// De gebruiker geeft enkel leestijd + fouten; niveau en status worden berekend
// op basis van de normtabel (leerjaar + periode van het toetsmoment).
export async function registreerAvi(
  _prev: AviActionResult | null,
  formData: FormData
): Promise<AviActionResult> {
  const leerlingId = String(formData.get("leerlingId") || "");
  const toetsmoment = String(formData.get("toetsmoment") || "").trim();
  const datumRaw = String(formData.get("datum") || "");
  const leestijd = Number(formData.get("leestijd"));
  const fouten = Number(formData.get("fouten"));

  if (!leerlingId || !toetsmoment) {
    return { ok: false, message: "Kies een leerling en toetsmoment." };
  }
  if (!Number.isFinite(leestijd) || !Number.isFinite(fouten)) {
    return { ok: false, message: "Vul een geldige leestijd en aantal fouten in." };
  }

  const parsed = parseToetsmoment(toetsmoment);
  if (!parsed) {
    return {
      ok: false,
      message: `Ongeldig toetsmoment "${toetsmoment}" (verwacht bv. M3 of E4).`,
    };
  }

  const normRow = await prisma.aviNormtabel.findUnique({
    where: { leerjaar_periode: { leerjaar: parsed.leerjaar, periode: parsed.periode } },
  });

  if (!normRow) {
    return {
      ok: false,
      message: `Geen normtabel-rij voor leerjaar ${parsed.leerjaar}, periode ${parsed.periode}. Voeg deze eerst toe in de normtabel.`,
    };
  }

  const norm: AviNorm = {
    leerjaar: normRow.leerjaar,
    periode: normRow.periode,
    aviNiveau: normRow.aviNiveau,
    tijdsgrens: normRow.tijdsgrens,
    foutengrens: normRow.foutengrens,
  };

  const { aviNiveau, status } = berekenAvi(norm, leestijd, fouten);

  await prisma.aviResultaat.create({
    data: {
      leerlingId,
      toetsmoment: toetsmoment.toUpperCase(),
      datum: datumRaw ? new Date(datumRaw) : new Date(),
      leestijdSeconden: leestijd,
      fouten,
      aviNiveau,
      status,
    },
  });

  revalidatePath("/avi");
  revalidatePath(`/leerlingen/${leerlingId}`);

  return {
    ok: true,
    message: `Geregistreerd: ${aviNiveau} — ${status} niveau.`,
    aviNiveau,
    status,
  };
}
