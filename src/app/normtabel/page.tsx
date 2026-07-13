import { prisma } from "@/lib/prisma";
import { updateNorm, voegNormToe, verwijderNorm } from "./actions";

export const dynamic = "force-dynamic";

export default async function NormtabelPage() {
  const normen = await prisma.aviNormtabel.findMany({
    orderBy: [{ leerjaar: "asc" }, { periode: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">AVI-normtabel</h1>
        <p className="text-sm text-slate-500">
          Configureer per leerjaar en periode het verwachte niveau en de grenzen.
          Deze waarden bepalen de automatische statusberekening (onder/op/boven
          niveau).
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Leerjaar</th>
              <th className="px-4 py-3 font-medium">Periode</th>
              <th className="px-4 py-3 font-medium">Verwacht niveau</th>
              <th className="px-4 py-3 font-medium">Tijdsgrens (s)</th>
              <th className="px-4 py-3 font-medium">Foutengrens</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {normen.map((n) => (
              <tr key={n.id}>
                <td className="px-4 py-2 font-medium text-slate-700">
                  {n.leerjaar}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {n.periode === "M" ? "Midden (M)" : "Eind (E)"}
                </td>
                <td colSpan={4} className="px-4 py-2">
                  <form
                    action={updateNorm}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="id" value={n.id} />
                    <input
                      type="text"
                      name="aviNiveau"
                      defaultValue={n.aviNiveau}
                      className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      name="tijdsgrens"
                      defaultValue={n.tijdsgrens}
                      className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      name="foutengrens"
                      defaultValue={n.foutengrens}
                      className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Opslaan
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Verwijderen apart, om form-nesting te vermijden */}
      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-600">
          Rij verwijderen
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {normen.map((n) => (
            <form key={n.id} action={verwijderNorm}>
              <input type="hidden" name="id" value={n.id} />
              <button
                type="submit"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100"
              >
                ✕ Leerjaar {n.leerjaar} · {n.periode}
              </button>
            </form>
          ))}
        </div>
      </details>

      {/* Nieuwe rij toevoegen */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">
          Rij toevoegen / bijwerken
        </h2>
        <form
          action={voegNormToe}
          className="grid grid-cols-2 gap-3 sm:grid-cols-5"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Leerjaar
            </label>
            <input
              type="number"
              name="leerjaar"
              required
              min={1}
              max={6}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Periode
            </label>
            <select
              name="periode"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="M">Midden (M)</option>
              <option value="E">Eind (E)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Niveau
            </label>
            <input
              type="text"
              name="aviNiveau"
              required
              placeholder="AVI-M3"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Tijdsgrens
            </label>
            <input
              type="number"
              name="tijdsgrens"
              required
              min={0}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Foutengrens
            </label>
            <input
              type="number"
              name="foutengrens"
              required
              min={0}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2 sm:col-span-5">
            <button
              type="submit"
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Toevoegen / bijwerken
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
