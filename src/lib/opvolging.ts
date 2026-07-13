// Hulpfuncties voor de opvolging van acties met een opvolgdatum.

export type OpvolgUrgentie = "verlopen" | "binnenkort" | "later";

// Aantal dagen dat als "binnenkort" telt.
export const BINNENKORT_DAGEN = 14;

// Bepaalt de urgentie van een openstaande opvolgdatum t.o.v. "nu".
export function opvolgUrgentie(
  opvolgdatum: Date | string,
  now: Date = new Date()
): OpvolgUrgentie {
  const d = typeof opvolgdatum === "string" ? new Date(opvolgdatum) : opvolgdatum;
  // Vergelijk op dagniveau (negeer tijdstip).
  const dag = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const vandaag = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const verschilDagen = Math.round(
    (dag.getTime() - vandaag.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (verschilDagen < 0) return "verlopen";
  if (verschilDagen <= BINNENKORT_DAGEN) return "binnenkort";
  return "later";
}

export const urgentieLabel: Record<OpvolgUrgentie, string> = {
  verlopen: "Verlopen",
  binnenkort: "Binnenkort",
  later: "Later",
};

export const urgentieColor: Record<OpvolgUrgentie, string> = {
  verlopen: "bg-red-100 text-red-800 border-red-200",
  binnenkort: "bg-amber-100 text-amber-800 border-amber-200",
  later: "bg-slate-100 text-slate-600 border-slate-200",
};
