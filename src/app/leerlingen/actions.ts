"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Voeg een actie of notitie toe aan het dossier van een leerling.
export async function voegActieToe(formData: FormData) {
  const leerlingId = String(formData.get("leerlingId"));
  const type = String(formData.get("type") || "notitie");
  const tekst = String(formData.get("tekst") || "").trim();
  const auteur = String(formData.get("auteur") || "").trim();
  const opvolgdatumRaw = String(formData.get("opvolgdatum") || "").trim();

  if (!leerlingId || !tekst) return;

  await prisma.actie.create({
    data: {
      leerlingId,
      type,
      tekst,
      auteur,
      opvolgdatum: opvolgdatumRaw ? new Date(opvolgdatumRaw) : null,
    },
  });

  revalidatePath(`/leerlingen/${leerlingId}`);
}

// Verwijder een actie/notitie.
export async function verwijderActie(formData: FormData) {
  const id = String(formData.get("id"));
  const leerlingId = String(formData.get("leerlingId"));
  if (!id) return;
  await prisma.actie.delete({ where: { id } });
  revalidatePath(`/leerlingen/${leerlingId}`);
}

// Werk de zorgstatus van een leerling bij.
export async function updateZorgstatus(formData: FormData) {
  const leerlingId = String(formData.get("leerlingId"));
  const status = String(formData.get("status"));
  if (!leerlingId) return;
  await prisma.leerling.update({
    where: { id: leerlingId },
    data: { status },
  });
  revalidatePath(`/leerlingen/${leerlingId}`);
}
