// ============================================================
// ratelimit.ts — Rate limiting simple (en mémoire)
// ============================================================
// MILESTONE 4 : remplacer par Cloudflare KV pour un vrai
// rate limiting persistant entre les instances du Worker.
// En attendant, cette version in-memory fonctionne pour le dev.
// ============================================================

// Map<ip, [count, windowStart timestamp]>
const cache = new Map<string, [number, number]>();

const WINDOW_MS = 60_000; // 1 minute

/**
 * Retourne true si le client doit être bloqué (trop de requêtes).
 * @param key     — identifiant du client (IP, token...)
 * @param maxRpm  — requêtes max par minute autorisées
 */
export async function checkRateLimit(key: string, maxRpm: number): Promise<boolean> {
  const now = Date.now();
  const existing = cache.get(key);

  if (!existing || now - existing[1] > WINDOW_MS) {
    // Nouvelle fenêtre
    cache.set(key, [1, now]);
    return false;
  }

  const [count, windowStart] = existing;

  if (count >= maxRpm) {
    return true; // bloqué
  }

  cache.set(key, [count + 1, windowStart]);
  return false;
}

// TODO Milestone 4 : implémenter avec Cloudflare KV
// Exemple :
//
// export async function checkRateLimit(key: string, maxRpm: number, kv: KVNamespace): Promise<boolean> {
//   const stored = await kv.get(key);
//   const count = stored ? parseInt(stored) : 0;
//   if (count >= maxRpm) return true;
//   await kv.put(key, String(count + 1), { expirationTtl: 60 });
//   return false;
// }
