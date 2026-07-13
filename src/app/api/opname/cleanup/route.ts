import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function isIngelogd(): Promise<boolean> {
  const expected = await expectedToken();
  if (!expected) return true;
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value === expected;
}

// Verwijdert het tijdelijk geüploade audiofragment na de transcriptie, zodat de
// audio niet blijft staan (privacy). Best-effort: fouten worden genegeerd.
export async function POST(req: Request) {
  if (!(await isIngelogd())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    mode?: string;
  };
  const url = String(body?.url ?? "");
  const mode = String(body?.mode ?? "");

  try {
    if (mode === "blob" && url && process.env.BLOB_READ_WRITE_TOKEN) {
      const { del } = await import("@vercel/blob");
      await del(url);
    } else if (mode === "put" && url) {
      // Generieke opslag: probeer te verwijderen via /delete/<id>.
      const delUrl = url.replace("/get/", "/delete/");
      await fetch(delUrl, { method: "POST" }).catch(() => {});
    }
  } catch (err) {
    console.error("[opname/cleanup] verwijderen mislukt:", err);
  }

  return NextResponse.json({ ok: true });
}
