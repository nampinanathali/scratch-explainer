// ============================================================
// cache.ts — Cache local des réponses LLM (7 jours, par script)
// ============================================================
// content.ts tourne dans le monde MAIN → pas d'accès à chrome.storage.
// Les lectures/écritures sont routées via bridge.ts par postMessage.
// ============================================================

import type { ExplainResponse } from "scratch-explainer-shared";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  response: ExplainResponse;
  timestamp: number;
}

/**
 * Supprime les valeurs des variables du snapshot avant de hasher.
 * "score=10, health=3" → "score, health"
 * Évite que le cache rate à cause des valeurs runtime qui changent au rechargement.
 */
function normalizeSnapshot(snapshot: string): string {
  return snapshot.replace(/=[^,\n]*/g, "");
}

async function fingerprint(snapshot: string, scriptId: string, modes: string[], language: string): Promise<string> {
  const text = [normalizeSnapshot(snapshot), scriptId, modes.join(","), language].join("|");
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function getBridgeEntry(key: string): Promise<CacheEntry | null> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "SCRATCH_EXPLAINER_CACHE_RESULT") return;
      if (event.data.key !== key) return;
      window.removeEventListener("message", handler);
      resolve(event.data.entry ?? null);
    };
    window.addEventListener("message", handler);
    window.postMessage({ type: "SCRATCH_EXPLAINER_GET_CACHE", key }, "*");
  });
}

export async function getCached(
  snapshot: string,
  scriptId: string,
  modes: string[],
  language: string
): Promise<ExplainResponse | null> {
  const key = await fingerprint(snapshot, scriptId, modes, language);
  const entry = await getBridgeEntry(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > SEVEN_DAYS_MS) return null;
  return entry.response;
}

export async function setCached(
  snapshot: string,
  scriptId: string,
  modes: string[],
  language: string,
  response: ExplainResponse
): Promise<void> {
  const key = await fingerprint(snapshot, scriptId, modes, language);
  const entry: CacheEntry = { response, timestamp: Date.now() };
  window.postMessage({ type: "SCRATCH_EXPLAINER_SET_CACHE", key, entry }, "*");
}
