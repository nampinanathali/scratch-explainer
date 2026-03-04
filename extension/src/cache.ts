// ============================================================
// cache.ts — Cache local des réponses LLM (7 jours, par script)
// ============================================================
// Clé = SHA-256(snapshot + scriptId + modes + language)
// Stocké dans chrome.storage.local sous "explain_cache"
// ============================================================

import type { ExplainResponse } from "scratch-explainer-shared";

const CACHE_KEY = "explain_cache";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  response: ExplainResponse;
  timestamp: number;
}

async function fingerprint(snapshot: string, scriptId: string, modes: string[], language: string): Promise<string> {
  const text = [snapshot, scriptId, modes.join(","), language].join("|");
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function getCached(
  snapshot: string,
  scriptId: string,
  modes: string[],
  language: string
): Promise<ExplainResponse | null> {
  const key = await fingerprint(snapshot, scriptId, modes, language);
  const result = await chrome.storage.local.get(CACHE_KEY);
  const cache: Record<string, CacheEntry> = result[CACHE_KEY] ?? {};
  const entry = cache[key];
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
  const result = await chrome.storage.local.get(CACHE_KEY);
  const cache: Record<string, CacheEntry> = result[CACHE_KEY] ?? {};

  // Purge les entrées expirées
  for (const k of Object.keys(cache)) {
    if (Date.now() - cache[k].timestamp > SEVEN_DAYS_MS) delete cache[k];
  }

  cache[key] = { response, timestamp: Date.now() };
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}
