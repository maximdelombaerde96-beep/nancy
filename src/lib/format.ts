// Kleine helpers voor weergave in de UI.

export function formatDatum(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function berekenLeeftijd(geboortedatum: Date | string): number {
  const geb = typeof geboortedatum === "string" ? new Date(geboortedatum) : geboortedatum;
  const nu = new Date();
  let leeftijd = nu.getFullYear() - geb.getFullYear();
  const m = nu.getMonth() - geb.getMonth();
  if (m < 0 || (m === 0 && nu.getDate() < geb.getDate())) leeftijd--;
  return leeftijd;
}

// Zorgstatus van een leerling -> label + kleur.
export const zorgStatusOpties = [
  { value: "geen", label: "Geen verhoogde zorg" },
  { value: "verhoogde_zorg", label: "Verhoogde zorg" },
  { value: "uitbreiding_zorg", label: "Uitbreiding van zorg" },
  { value: "individueel", label: "Individueel traject (IAC)" },
] as const;

export function zorgStatusLabel(status: string): string {
  return zorgStatusOpties.find((o) => o.value === status)?.label ?? status;
}

export function zorgStatusColor(status: string): string {
  switch (status) {
    case "verhoogde_zorg":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "uitbreiding_zorg":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "individueel":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}
