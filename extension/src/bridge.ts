// ============================================================
// bridge.ts — Pont entre MAIN world et ISOLATED world
// ============================================================
// content.ts tourne dans le monde MAIN (accès à Scratch/JS de la page)
// mais n'a pas accès à chrome.storage.
//
// bridge.ts tourne dans le monde ISOLATED (accès à chrome.storage)
// mais n'a pas accès aux objets JavaScript de la page.
//
// Les deux se parlent via window.postMessage.
// ============================================================

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = "explain_cache";

window.addEventListener("message", async (event: MessageEvent) => {
  if (event.source !== window) return;

  // ─── Settings ────────────────────────────────────────────
  if (event.data?.type === "SCRATCH_EXPLAINER_GET_SETTINGS") {
    const result = await chrome.storage.local.get("settings");
    window.postMessage(
      { type: "SCRATCH_EXPLAINER_SETTINGS", settings: result.settings ?? null },
      "*"
    );
    return;
  }

  // ─── Cache : lecture ──────────────────────────────────────
  if (event.data?.type === "SCRATCH_EXPLAINER_GET_CACHE") {
    const { key } = event.data as { key: string };
    const result = await chrome.storage.local.get(CACHE_KEY);
    const cache = result[CACHE_KEY] ?? {};
    window.postMessage(
      { type: "SCRATCH_EXPLAINER_CACHE_RESULT", key, entry: cache[key] ?? null },
      "*"
    );
    return;
  }

  // ─── Cache : écriture ─────────────────────────────────────
  if (event.data?.type === "SCRATCH_EXPLAINER_SET_CACHE") {
    const { key, entry } = event.data as { key: string; entry: { response: unknown; timestamp: number } };
    const result = await chrome.storage.local.get(CACHE_KEY);
    const cache: Record<string, { response: unknown; timestamp: number }> = result[CACHE_KEY] ?? {};

    // Purge des entrées expirées
    for (const k of Object.keys(cache)) {
      if (Date.now() - cache[k].timestamp > SEVEN_DAYS_MS) delete cache[k];
    }

    cache[key] = entry;
    await chrome.storage.local.set({ [CACHE_KEY]: cache });
    return;
  }
});
