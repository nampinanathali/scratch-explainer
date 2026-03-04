// ============================================================
// api.ts — Appel au proxy Cloudflare Worker
// ============================================================
// MILESTONE 4 : brancher l'appel HTTP réel
// ============================================================

import type {
  ExplainRequest,
  ExplainResponse,
  ErrorResponse,
} from "scratch-explainer-shared";

// L'URL du worker est stockée dans chrome.storage pour être configurable
// sans recompiler l'extension.
async function getWorkerUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get("workerUrl", (data) => {
      // URL par défaut pendant le développement local (wrangler dev)
      resolve(data.workerUrl ?? "http://localhost:8787");
    });
  });
}

async function getClientToken(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get("clientToken", (data) => {
      resolve(data.clientToken ?? "");
    });
  });
}

/**
 * Envoie le snapshot + cible au proxy et retourne l'explication JSON.
 * Lève une Error en cas de problème réseau ou d'erreur serveur.
 */
export async function explainScript(
  request: ExplainRequest
): Promise<ExplainResponse> {
  const workerUrl = await getWorkerUrl();
  const token = await getClientToken();

  const response = await fetch(`${workerUrl}/explain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Token": token,
    },
    body: JSON.stringify(request),
  });

  const data: ExplainResponse | ErrorResponse = await response.json();

  if (!response.ok) {
    const err = data as ErrorResponse;
    throw new Error(`[${err.error}] ${err.message}`);
  }

  return data as ExplainResponse;
}
