// ============================================================================
//  Lokale (IndexedDB) opslag van opgenomen audio, zodat een opname NIET
//  verloren gaat als de upload/transcriptie faalt of de gebruiker wegnavigeert.
//  De audio blijft lokaal bewaard tot upload + transcriptie bevestigd zijn.
// ============================================================================

const DB_NAAM = "zorgdossier-opnames";
const STORE = "opnames";
const VERSIE = 1;

export interface BewaardeOpname {
  id: string;
  leerlingId: string;
  leerlingNaam: string;
  createdAt: number;
  seconden: number;
  mime: string;
  blob: Blob;
}

function beschikbaar(): boolean {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAAM, VERSIE);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("leerlingId", "leerlingId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function bewaarOpname(rec: BewaardeOpname): Promise<void> {
  if (!beschikbaar()) return;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function haalOpname(id: string): Promise<BewaardeOpname | undefined> {
  if (!beschikbaar()) return undefined;
  const db = await open();
  const res = await new Promise<BewaardeOpname | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as BewaardeOpname | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return res;
}

export async function haalOpnamesVoorLeerling(
  leerlingId: string
): Promise<BewaardeOpname[]> {
  if (!beschikbaar()) return [];
  const db = await open();
  const res = await new Promise<BewaardeOpname[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const idx = tx.objectStore(STORE).index("leerlingId");
    const req = idx.getAll(leerlingId);
    req.onsuccess = () => resolve((req.result as BewaardeOpname[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return res.sort((a, b) => b.createdAt - a.createdAt);
}

export async function verwijderOpname(id: string): Promise<void> {
  if (!beschikbaar()) return;
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
