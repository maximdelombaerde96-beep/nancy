"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leerlingen", label: "Leerlingen" },
  { href: "/opvolging", label: "Opvolging" },
  { href: "/avi", label: "AVI-overzicht" },
  { href: "/normtabel", label: "Normtabel" },
];

export default function NavBar({ authEnabled = false }: { authEnabled?: boolean }) {
  const pathname = usePathname();

  // Geen navigatie op de inlogpagina.
  if (pathname === "/login") return null;

  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/leerlingen" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">
            Z
          </span>
          <span className="text-lg font-semibold text-slate-800">Zorgdossier</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            MVP · fictieve testdata
          </span>
          {authEnabled && (
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Afmelden
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
