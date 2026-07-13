// ============================================================================
//  Server-side AssemblyAI-integratie voor nauwkeurige transcriptie mét
//  sprekersherkenning (speaker diarization), taal Nederlands.
//
//  De API key (ASSEMBLYAI_API_KEY) wordt UITSLUITEND server-side gebruikt.
//  De audio wordt tijdelijk naar AssemblyAI gestuurd voor verwerking en NIET
//  in onze database bewaard — enkel het resulterende teksttranscript.
//
//  De base-URL is override-baar via ASSEMBLYAI_BASE_URL (voor tests met een
//  lokale mock, zonder echte API-kosten).
// ============================================================================

export class GeenAssemblyKeyError extends Error {
  constructor() {
    super("Geen AssemblyAI API key ingesteld (ASSEMBLYAI_API_KEY).");
    this.name = "GeenAssemblyKeyError";
  }
}

export class AssemblyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AssemblyError";
    this.status = status;
  }
}

function baseUrl(): string {
  return process.env.ASSEMBLYAI_BASE_URL?.trim() || "https://api.assemblyai.com";
}

function apiKey(): string {
  const k = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!k) throw new GeenAssemblyKeyError();
  return k;
}

// Controle of er een key is (voor een snelle 503 vóór het lezen van de body).
export function heeftAssemblyKey(): boolean {
  return Boolean(process.env.ASSEMBLYAI_API_KEY && process.env.ASSEMBLYAI_API_KEY.trim());
}

// Stap 1: upload de audio-bytes naar AssemblyAI, krijg een upload-URL terug.
export async function uploadAudio(bytes: ArrayBuffer): Promise<string> {
  const res = await fetch(`${baseUrl()}/v2/upload`, {
    method: "POST",
    headers: { authorization: apiKey(), "content-type": "application/octet-stream" },
    body: Buffer.from(bytes),
  });
  if (!res.ok) throw new AssemblyError(res.status, await res.text());
  const data = await res.json();
  return data.upload_url as string;
}

// Stap 2: start een transcriptie-job met sprekersherkenning + Nederlands.
export async function startTranscript(audioUrl: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`${baseUrl()}/v2/transcript`, {
    method: "POST",
    headers: { authorization: apiKey(), "content-type": "application/json" },
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true, // sprekersherkenning (diarization)
      language_code: "nl", // Nederlands
    }),
  });
  if (!res.ok) throw new AssemblyError(res.status, await res.text());
  const d = await res.json();
  return { id: d.id as string, status: d.status as string };
}

export interface Utterance {
  speaker: string; // "A", "B", ...
  text: string;
}

export interface TranscriptStatus {
  status: string; // "queued" | "processing" | "completed" | "error"
  text?: string;
  utterances?: Utterance[];
  error?: string;
}

// Stap 3: poll de status/resultaat van een transcriptie-job.
export async function getTranscript(id: string): Promise<TranscriptStatus> {
  const res = await fetch(`${baseUrl()}/v2/transcript/${encodeURIComponent(id)}`, {
    headers: { authorization: apiKey() },
  });
  if (!res.ok) throw new AssemblyError(res.status, await res.text());
  const d = await res.json();
  return {
    status: d.status,
    text: d.text ?? undefined,
    utterances: Array.isArray(d.utterances)
      ? d.utterances.map((u: { speaker: string; text: string }) => ({
          speaker: u.speaker,
          text: u.text,
        }))
      : undefined,
    error: d.error ?? undefined,
  };
}
