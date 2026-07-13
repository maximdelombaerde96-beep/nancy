import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";
import {
  uploadAudio,
  startTranscript,
  heeftAssemblyKey,
  GeenAssemblyKeyError,
  AssemblyError,
} from "@/lib/assemblyai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function isIngelogd(): Promise<boolean> {
  const expected = await expectedToken();
  if (!expected) return true;
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value === expected;
}

function fout(status: number, message: string) {
  return NextResponse.json({ ok: false, message }, { status });
}

// Ontvangt het audiofragment, uploadt het naar AssemblyAI en start een
// transcriptie-job met sprekersherkenning. Geeft meteen het job-id terug;
// de client pollt daarna GET /api/opname/transcript/[id].
export async function POST(req: Request) {
  if (!(await isIngelogd())) return fout(401, "Niet ingelogd.");

  if (!heeftAssemblyKey()) {
    return fout(
      503,
      "Geen AssemblyAI API key ingesteld. Voeg ASSEMBLYAI_API_KEY toe in de environment variables."
    );
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await req.arrayBuffer();
  } catch {
    return fout(400, "Kon de audio niet lezen.");
  }
  if (!bytes || bytes.byteLength === 0) {
    return fout(400, "Geen audio ontvangen.");
  }

  try {
    const uploadUrl = await uploadAudio(bytes);
    const { id, status } = await startTranscript(uploadUrl);
    return NextResponse.json({ ok: true, id, status });
  } catch (err) {
    if (err instanceof GeenAssemblyKeyError) {
      return fout(503, "Geen AssemblyAI API key ingesteld.");
    }
    if (err instanceof AssemblyError) {
      return fout(
        err.status && err.status >= 400 ? err.status : 502,
        `AssemblyAI-fout: ${err.message}`
      );
    }
    console.error("[opname/transcript] start mislukt:", err);
    return fout(500, `Onverwachte fout: ${(err as Error).message}`);
  }
}
