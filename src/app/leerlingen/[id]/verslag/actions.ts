"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { genereerVerslag, type GegenereerdVerslag } from "@/lib/claude";

export interface GenereerResult {
  ok: boolean;
  message?: string;
  data?: GegenereerdVerslag;
  // De ingevoerde waarden worden mee teruggegeven zodat stap 2 ze kan bewaren.
  input?: { brontekst: string; aanwezigen: string; datum: string };
}

// Stap 1: genereer een concept-verslag uit de losse notities (AI of mock).
// Slaat nog NIETS op — de gebruiker beoordeelt eerst.
export async function genereerConcept(
  _prev: GenereerResult | null,
  formData: FormData
): Promise<GenereerResult> {
  const leerlingId = String(formData.get("leerlingId") || "");
  const brontekst = String(formData.get("brontekst") || "").trim();
  const aanwezigen = String(formData.get("aanwezigen") || "").trim();
  const datum = String(formData.get("datum") || "").trim();

  if (!brontekst) {
    return { ok: false, message: "Voer eerst enkele notities in." };
  }

  const leerling = await prisma.leerling.findUnique({
    where: { id: leerlingId },
    include: { klas: true },
  });
  if (!leerling) return { ok: false, message: "Leerling niet gevonden." };

  const data = await genereerVerslag(brontekst, {
    leerlingNaam: `${leerling.voornaam} ${leerling.achternaam}`,
    klas: leerling.klas?.naam,
    aanwezigen,
    datum,
  });

  return { ok: true, data, input: { brontekst, aanwezigen, datum } };
}

// Stap 2: sla het (eventueel bijgewerkte) verslag op na goedkeuring.
export async function bewaarVerslag(formData: FormData) {
  const leerlingId = String(formData.get("leerlingId") || "");
  const brontekst = String(formData.get("brontekst") || "");
  const aanwezigen = String(formData.get("aanwezigen") || "");
  const datumRaw = String(formData.get("datum") || "");
  const gegenereerdVerslag = String(formData.get("gegenereerdVerslag") || "");
  const actiepunten = String(formData.get("actiepunten") || "");
  const opvolgdatumRaw = String(formData.get("opvolgdatum") || "");

  if (!leerlingId || !gegenereerdVerslag) return;

  const verslag = await prisma.verslag.create({
    data: {
      leerlingId,
      datum: datumRaw ? new Date(datumRaw) : new Date(),
      aanwezigen,
      brontekst,
      gegenereerdVerslag,
      actiepunten,
      opvolgdatum: opvolgdatumRaw ? new Date(opvolgdatumRaw) : null,
    },
  });

  // Maak automatisch een opvolgactie aan als er een opvolgdatum is.
  if (opvolgdatumRaw) {
    await prisma.actie.create({
      data: {
        leerlingId,
        type: "actie",
        tekst: `Opvolging verslag van ${
          datumRaw ? new Date(datumRaw).toLocaleDateString("nl-BE") : "vandaag"
        }.`,
        opvolgdatum: new Date(opvolgdatumRaw),
        auteur: "Zorgcoördinator",
      },
    });
  }

  revalidatePath(`/leerlingen/${leerlingId}`);
  redirect(`/leerlingen/${leerlingId}/verslag/${verslag.id}`);
}
