import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function isIngelogd(): Promise<boolean> {
  const expected = await expectedToken();
  if (!expected) return true;
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value === expected;
}

// Geeft een tijdelijk client-upload-token uit voor Vercel Blob, zodat de browser
// het audiofragment RECHTSTREEKS naar Blob kan uploaden (niet via onze route).
// De BLOB_READ_WRITE_TOKEN blijft server-side. Deze route is bewust uitgesloten
// van het wachtwoord-poortje (zie middleware) omdat Vercel de upload-completed
// callback zonder onze cookie aanroept; de authenticatie gebeurt hieronder in
// onBeforeGenerateToken voor de token-aanvraag zelf.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Enkel ingelogde gebruikers mogen een upload-token krijgen.
        if (!(await isIngelogd())) {
          throw new Error("Niet ingelogd.");
        }
        return {
          allowedContentTypes: [
            "audio/webm",
            "audio/ogg",
            "audio/mp4",
            "audio/mpeg",
            "audio/wav",
            "application/octet-stream",
          ],
          maximumSizeInBytes: 1024 * 1024 * 1024, // 1 GB — ruim voor 60+ min
          addRandomSuffix: true,
        };
      },
      // We bewaren de audio niet: de opname wordt na de transcriptie verwijderd
      // via /api/opname/cleanup. Hier hoeven we niets te doen.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message },
      { status: 400 }
    );
  }
}
