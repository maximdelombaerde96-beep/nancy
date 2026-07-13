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

// Start een AssemblyAI-transcriptie (sprekersherkenning, nl).
// Twee manieren waarop de audio binnenkomt:
//  1) JSON { audioUrl } — de browser heeft de audio al RECHTSTREEKS naar de
//     opslag geüpload (geen 4,5MB-limiet); wij starten enkel de transcriptie
//     op die URL. (De aanbevolen weg voor lange opnames.)
//  2) Ruwe audio-body — fallback wanneer er geen directe opslag geconfigureerd
//     is: wij uploaden de audio server-side naar AssemblyAI.
export async function POST(req: Request) {
  if (!(await isIngelogd())) return fout(401, "Niet ingelogd.");

  if (!heeftAssemblyKey()) {
    return fout(
      503,
      "Geen AssemblyAI API key ingesteld. Voeg ASSEMBLYAI_API_KEY toe in de environment variables."
    );
  }

  const contentType = req.headers.get("content-type") || "";

  try {
    let audioUrl: string;

    if (contentType.includes("application/json")) {
      // Modus 1: audio staat al in de opslag.
      const body = (await req.json().catch(() => ({}))) as { audioUrl?: unknown };
      audioUrl = String(body?.audioUrl ?? "").trim();
      if (!audioUrl) return fout(400, "Geen audioUrl ontvangen.");
    } else {
      // Modus 2 (fallback): ruwe audio → server-side upload naar AssemblyAI.
      const bytes = await req.arrayBuffer();
      if (!bytes || bytes.byteLength === 0) {
        return fout(400, "Geen audio ontvangen.");
      }
      audioUrl = await uploadAudio(bytes);
    }

    const { id, status } = await startTranscript(audioUrl);
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
