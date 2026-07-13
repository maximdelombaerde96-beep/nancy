"use client";

import { useEffect } from "react";

// Knop die de printdialoog opent (browser: "Opslaan als PDF").
// Met `auto` opent de dialoog automatisch bij het laden van de pagina.
export default function PrintButton({
  auto = false,
  label = "🖨️ Print / PDF",
}: {
  auto?: boolean;
  label?: string;
}) {
  useEffect(() => {
    if (auto) {
      // korte vertraging zodat de pagina volledig gerenderd is
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [auto]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}
