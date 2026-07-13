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

// Geeft de browser een tijdelijk upload-doel zodat de audio RECHTSTREEKS naar de
// opslag geüpload kan worden (niet via onze eigen serverless-route → geen
// 4,5MB-limiet). De keuze van opslag gebeurt volledig server-side:
//
//   - "blob": Vercel Blob (aanbevolen op Vercel; zet een Blob-store op →
//              BLOB_READ_WRITE_TOKEN). De browser gebruikt @vercel/blob/client
//              met een server-uitgegeven token (route /api/opname/blob-upload).
//   - "put":  een generieke, server-uitgegeven presigned PUT-URL (bv. S3/R2 of
//              een compatibele opslag via OPNAME_UPLOAD_ENDPOINT). De browser
//              doet een directe HTTP PUT naar uploadUrl.
//   - "none": geen directe opslag geconfigureerd → de client valt terug op de
//              oude weg (audio via onze route, tot ~4,5MB).
export async function POST() {
  if (!(await isIngelogd())) {
    return NextResponse.json({ ok: false, message: "Niet ingelogd." }, { status: 401 });
  }

  const naam = `oudergesprek-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webm`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: true, mode: "blob", pathname: naam });
  }

  const endpoint = process.env.OPNAME_UPLOAD_ENDPOINT?.trim();
  if (endpoint) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return NextResponse.json({
      ok: true,
      mode: "put",
      uploadUrl: `${endpoint}/put/${id}`,
      downloadUrl: `${endpoint}/get/${id}`,
    });
  }

  return NextResponse.json({ ok: true, mode: "none" });
}
