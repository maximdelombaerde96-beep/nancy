"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Werk één normtabel-rij bij (tijdsgrens, foutengrens, niveau).
export async function updateNorm(formData: FormData) {
  const id = String(formData.get("id"));
  const aviNiveau = String(formData.get("aviNiveau") || "").trim();
  const tijdsgrens = Number(formData.get("tijdsgrens"));
  const foutengrens = Number(formData.get("foutengrens"));
  if (!id) return;

  await prisma.aviNormtabel.update({
    where: { id },
    data: { aviNiveau, tijdsgrens, foutengrens },
  });
  revalidatePath("/normtabel");
  revalidatePath("/avi");
}

// Voeg een nieuwe normtabel-rij toe.
export async function voegNormToe(formData: FormData) {
  const leerjaar = Number(formData.get("leerjaar"));
  const periode = String(formData.get("periode") || "").trim().toUpperCase();
  const aviNiveau = String(formData.get("aviNiveau") || "").trim();
  const tijdsgrens = Number(formData.get("tijdsgrens"));
  const foutengrens = Number(formData.get("foutengrens"));

  if (!Number.isFinite(leerjaar) || !periode || !aviNiveau) return;

  await prisma.aviNormtabel.upsert({
    where: { leerjaar_periode: { leerjaar, periode } },
    update: { aviNiveau, tijdsgrens, foutengrens },
    create: { leerjaar, periode, aviNiveau, tijdsgrens, foutengrens },
  });
  revalidatePath("/normtabel");
  revalidatePath("/avi");
}

// Verwijder een normtabel-rij.
export async function verwijderNorm(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;
  await prisma.aviNormtabel.delete({ where: { id } });
  revalidatePath("/normtabel");
}
