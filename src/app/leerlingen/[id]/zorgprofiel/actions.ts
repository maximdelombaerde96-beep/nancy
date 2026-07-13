"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Zorgt dat er een zorgprofiel bestaat voor de leerling (maakt er anders één aan).
async function ensureZorgprofiel(leerlingId: string) {
  const bestaand = await prisma.zorgprofiel.findUnique({ where: { leerlingId } });
  if (bestaand) return bestaand;
  return prisma.zorgprofiel.create({ data: { leerlingId } });
}

// Werk de hoofdvelden van het zorgprofiel bij (logo, leersteun, zorgmaatregelen).
export async function updateZorgprofiel(formData: FormData) {
  const leerlingId = String(formData.get("leerlingId") || "");
  if (!leerlingId) return;

  const logo = formData.get("logo") === "on";
  const logoOmschrijving = String(formData.get("logoOmschrijving") || "").trim();
  const leersteun = formData.get("leersteun") === "on";
  const leersteunUren = Number(formData.get("leersteunUren")) || 0;
  const leersteunType = String(formData.get("leersteunType") || "").trim();
  const zorgmaatregelen = String(formData.get("zorgmaatregelen") || "").trim();

  const data = {
    logo,
    logoOmschrijving,
    leersteun,
    leersteunUren,
    leersteunType,
    zorgmaatregelen,
  };

  await prisma.zorgprofiel.upsert({
    where: { leerlingId },
    update: data,
    create: { leerlingId, ...data },
  });

  revalidatePath(`/leerlingen/${leerlingId}`);
}

// Voeg een diagnose toe aan het zorgprofiel.
export async function voegDiagnoseToe(formData: FormData) {
  const leerlingId = String(formData.get("leerlingId") || "");
  const type = String(formData.get("type") || "").trim();
  const datum = String(formData.get("datum") || "").trim();
  const bron = String(formData.get("bron") || "").trim();
  if (!leerlingId || !type) return;

  const zp = await ensureZorgprofiel(leerlingId);
  await prisma.diagnose.create({
    data: {
      zorgprofielId: zp.id,
      type,
      datum: datum ? new Date(datum) : new Date(),
      bron,
    },
  });
  revalidatePath(`/leerlingen/${leerlingId}`);
}

// Werk een bestaande diagnose bij.
export async function updateDiagnose(formData: FormData) {
  const id = String(formData.get("id") || "");
  const leerlingId = String(formData.get("leerlingId") || "");
  const type = String(formData.get("type") || "").trim();
  const datum = String(formData.get("datum") || "").trim();
  const bron = String(formData.get("bron") || "").trim();
  if (!id || !type) return;

  await prisma.diagnose.update({
    where: { id },
    data: { type, datum: datum ? new Date(datum) : new Date(), bron },
  });
  revalidatePath(`/leerlingen/${leerlingId}`);
}

// Verwijder een diagnose.
export async function verwijderDiagnose(formData: FormData) {
  const id = String(formData.get("id") || "");
  const leerlingId = String(formData.get("leerlingId") || "");
  if (!id) return;
  await prisma.diagnose.delete({ where: { id } });
  revalidatePath(`/leerlingen/${leerlingId}`);
}
