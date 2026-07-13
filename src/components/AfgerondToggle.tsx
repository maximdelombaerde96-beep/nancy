"use client";

import { zetActieAfgerond } from "@/app/leerlingen/actions";

// Kleine toggle om een actie als afgerond te markeren of te heropenen.
export default function AfgerondToggle({
  actieId,
  leerlingId,
  afgerond,
}: {
  actieId: string;
  leerlingId: string;
  afgerond: boolean;
}) {
  return (
    <form action={zetActieAfgerond} className="inline">
      <input type="hidden" name="id" value={actieId} />
      <input type="hidden" name="leerlingId" value={leerlingId} />
      <input type="hidden" name="afgerond" value={afgerond ? "false" : "true"} />
      <button
        type="submit"
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
          afgerond
            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        }`}
        title={afgerond ? "Heropenen" : "Als afgerond markeren"}
      >
        <span
          className={`grid h-4 w-4 place-items-center rounded border text-[10px] ${
            afgerond
              ? "border-green-500 bg-green-500 text-white"
              : "border-slate-300 bg-white"
          }`}
        >
          {afgerond ? "✓" : ""}
        </span>
        {afgerond ? "Afgerond" : "Openstaand"}
      </button>
    </form>
  );
}
