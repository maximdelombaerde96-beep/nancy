import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { gateEnabled, veiligPad } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const sp = await searchParams;
  const from = veiligPad(sp.from);

  // Staat het poortje uit, dan is inloggen niet nodig.
  if (!gateEnabled()) redirect(from);

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 font-bold text-white">
            Z
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Zorgdossier</h1>
            <p className="text-xs text-slate-500">Beveiligde toegang</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Voer het gedeelde wachtwoord in om verder te gaan.
        </p>
        <LoginForm from={from} />
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">
        Deze tool bevat fictieve testdata.
      </p>
    </div>
  );
}
