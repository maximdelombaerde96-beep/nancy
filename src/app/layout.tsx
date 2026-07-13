import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { gateEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Zorgdossier Tool",
  description: "Lokale MVP voor zorgopvolging in het lager onderwijs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body>
        <NavBar authEnabled={gateEnabled()} />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
