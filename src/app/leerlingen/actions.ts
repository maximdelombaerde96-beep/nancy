"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ---------------------------------------------------------------------------
//  CRUD voor leerlingen (aanmaken, bewerken, archiveren, verwijderen)
// ---------------------------------------------------------------------------

export interface LeerlingFormState {
  error?: string;
}

// Leest en valideert de gedeelde leerling-velden uit een formulier.
function parseLeerlingForm(formData: FormData) {
  const voornaam = String(formData.get("voornaam") || "").trim();
  const achternaam = String(formData.get("achternaam") || "").trim();
  const geboortedatum = String(formData.get("geboortedatum") || "").trim();
  const klasId = String(formData.get("klasId") || "").trim();
  const leerjaarRaw = String(formData.get("leerjaar") || "").trim();
  const schooljaar = String(formData.get("schooljaar") || "").trim();
  const status = String(formData.get("status") || "geen").trim();

  if (!voornaam || !achternaam) return { error: "Voor- en achternaam zijn verplicht." };
  if (!geboortedatum) return { error: "Geboortedatum is verplicht." };
  const leerjaar = Number(leerjaarRaw);
  if (!Number.isFinite(leerjaar) || leerjaar < 1 || leerjaar > 6)
    return { error: "Leerjaar moet tussen 1 en 6 liggen." };
  if (!schooljaar) return { error: "Schooljaar is verplicht." };

  return {
    data: {
      voornaam,
      achternaam,
      geboortedatum: new Date(geboortedatum),
      klasId: klasId || null,
      leerjaar,
      schooljaar,
      status,
    },
  };
}

// Maak een nieuwe leerling aan.
export async function maakLeerling(
  _prev: LeerlingFormState | null,
  formData: FormData
): Promise<LeerlingFormState> {
  const parsed = parseLeerlingForm(formData);
  if (parsed.error) return { error: parsed.error };

  const leerling = await prisma.leerling.create({ data: parsed.data! });
  revalidatePath("/leerlingen");
  redirect(`/leerlingen/${leerling.id}`);
}

// Werk een bestaande leerling bij.
export async function updateLeerling(
  _prev: LeerlingFormState | null,
  formData: FormData
): Promise<LeerlingFormState> {
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Onbekende leerling." };

  const parsed = parseLeerlingForm(formData);
  if (parsed.error) return { error: parsed.error };

  await prisma.leerling.update({ where: { id }, data: parsed.data! });
  revalidatePath("/leerlingen");
  revalidatePath(`/leerlingen/${id}`);
  redirect(`/leerlingen/${id}`);
}

// Archiveer of herstel een leerling (omkeerbaar).
export async function zetArchief(formData: FormData) {
  const id = String(formData.get("id") || "");
  const gearchiveerd = String(formData.get("gearchiveerd") || "") === "true";
  if (!id) return;
  await prisma.leerling.update({ where: { id }, data: { gearchiveerd } });
  revalidatePath("/leerlingen");
  revalidatePath(`/leerlingen/${id}`);
}

// Verwijder een leerling definitief (incl. dossier, via cascade).
export async function verwijderLeerling(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.leerling.delete({ where: { id } });
  revalidatePath("/leerlingen");
  redirect("/leerlingen");
}

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

// Markeer een actie als afgerond of heropen ze.
export async function zetActieAfgerond(formData: FormData) {
  const id = String(formData.get("id"));
  const leerlingId = String(formData.get("leerlingId"));
  const afgerond = String(formData.get("afgerond")) === "true";
  if (!id) return;
  await prisma.actie.update({
    where: { id },
    data: { afgerond, afgerondOp: afgerond ? new Date() : null },
  });
  revalidatePath(`/leerlingen/${leerlingId}`);
  revalidatePath("/opvolging");
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
