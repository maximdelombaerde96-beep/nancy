// AVI-berekeningslogica.
//
// De gebruiker vult enkel leestijd (in seconden) en aantal fouten in.
// Op basis van de normtabel (leerjaar + periode) bepaalt het systeem:
//   - het verwachte AVI-niveau (uit de normtabel);
//   - de status: onder / op / boven niveau.
//
// Deze logica wordt zowel door de seed als door de app gebruikt.

export type AviStatus = "onder" | "op" | "boven";

export interface AviNorm {
  leerjaar: number;
  periode: string; // "M" of "E"
  aviNiveau: string; // verwacht niveau, bv. "AVI-M3"
  tijdsgrens: number; // max seconden voor "op niveau"
  foutengrens: number; // max fouten voor "op niveau"
}

export interface AviBerekening {
  aviNiveau: string;
  status: AviStatus;
}

// Vertaalt een toetsmoment (bv. "M3", "E4") naar leerjaar + periode.
export function parseToetsmoment(
  toetsmoment: string
): { leerjaar: number; periode: string } | null {
  const match = toetsmoment.trim().toUpperCase().match(/^([ME])\s*(\d)$/);
  if (!match) return null;
  return { periode: match[1], leerjaar: Number(match[2]) };
}

// Kern van de berekening: gegeven de norm + de meting, bepaal niveau en status.
//
// Logica voor status:
//   - Zowel tijd als fouten binnen de grens  -> "op" niveau
//   - Beide ruim binnen de grens (< 80%)     -> "boven" niveau
//   - Tijd óf fouten boven de grens          -> "onder" niveau
export function berekenAvi(
  norm: AviNorm,
  leestijdSeconden: number,
  fouten: number
): AviBerekening {
  const binnenTijd = leestijdSeconden <= norm.tijdsgrens;
  const binnenFouten = fouten <= norm.foutengrens;

  let status: AviStatus;
  if (!binnenTijd || !binnenFouten) {
    status = "onder";
  } else if (
    leestijdSeconden <= norm.tijdsgrens * 0.8 &&
    fouten <= Math.floor(norm.foutengrens * 0.8)
  ) {
    status = "boven";
  } else {
    status = "op";
  }

  return { aviNiveau: norm.aviNiveau, status };
}

// Handige labels/kleuren voor de UI.
export const statusLabel: Record<AviStatus, string> = {
  onder: "Onder niveau",
  op: "Op niveau",
  boven: "Boven niveau",
};

export const statusColor: Record<AviStatus, string> = {
  onder: "bg-red-100 text-red-800 border-red-200",
  op: "bg-green-100 text-green-800 border-green-200",
  boven: "bg-blue-100 text-blue-800 border-blue-200",
};
