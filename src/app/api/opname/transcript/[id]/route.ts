import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";
import {
  getTranscript,
  GeenAssemblyKeyError,
  AssemblyError,
} from "@/lib/assemblyai";

export const dynamic = "force-dynamic";

async function isIngelogd(): Promise<boolean> {
  const expected = await expectedToken();
  if (!expected) return true;
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value === expected;
}

function fout(status: number, message: string) {
  return NextResponse.json({ ok: false, message }, { status });
}

// Pollt de status/resultaat van een AssemblyAI-transcriptie-job.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isIngelogd())) return fout(401, "Niet ingelogd.");

  const { id } = await params;
  if (!id) return fout(400, "Geen transcriptie-id.");

  try {
    const st = await getTranscript(id);
    if (st.status === "error") {
      return NextResponse.json({
        ok: false,
        status: "error",
        message: st.error || "Transcriptie mislukt bij AssemblyAI.",
      });
    }
    return NextResponse.json({
      ok: true,
      status: st.status, // queued | processing | completed
      done: st.status === "completed",
      utterances: st.utterances ?? [],
      text: st.text ?? "",
    });
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
    console.error("[opname/transcript/id] poll mislukt:", err);
    return fout(500, `Onverwachte fout: ${(err as Error).message}`);
  }
}
