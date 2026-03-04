// ============================================================
// index.ts — Cloudflare Worker : point d'entrée HTTP
// ============================================================
// Route unique : POST /explain
// ============================================================

import { buildSystemPrompt, buildUserMessage } from "./prompt";
import { validateResponse } from "./schema";
import { checkRateLimit } from "./ratelimit";
import type { ExplainRequest, ExplainResponse, ErrorResponse } from "scratch-explainer-shared";
import OpenAI from "openai";

// Variables d'environnement injectées par Cloudflare (voir wrangler.toml + secrets)
export interface Env {
  OPENAI_API_KEY: string;
  CLIENT_TOKEN: string;
  MAX_PAYLOAD_BYTES: string;
  RATE_LIMIT_RPM: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS pour le développement local (l'extension envoie depuis chrome-extension://)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Client-Token, X-Mock",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST" || new URL(request.url).pathname !== "/explain") {
      return jsonError("INVALID_REQUEST", "Route inconnue. Utiliser POST /explain", 404);
    }

    // 1. Auth
    const token = request.headers.get("X-Client-Token");
    if (!token || token !== env.CLIENT_TOKEN) {
      return jsonError("UNAUTHORIZED", "Token invalide ou manquant", 401);
    }

    // 2. Taille du payload
    const contentLength = Number(request.headers.get("Content-Length") ?? 0);
    const maxBytes = Number(env.MAX_PAYLOAD_BYTES);
    if (contentLength > maxBytes * 2) {
      return jsonError("PAYLOAD_TOO_LARGE", `Payload > ${maxBytes * 2} bytes refusé`, 413);
    }

    // 3. Lecture + parsing JSON
    let body: ExplainRequest;
    try {
      const raw = await request.text();
      if (raw.length > maxBytes) {
        return jsonError("PAYLOAD_TOO_LARGE", `Snapshot > ${maxBytes} bytes`, 413);
      }
      body = JSON.parse(raw) as ExplainRequest;
    } catch {
      return jsonError("INVALID_REQUEST", "JSON invalide", 400);
    }

    // 4. Validation champs requis
    if (!body.project_snapshot || !body.script_target?.script_id) {
      return jsonError("INVALID_REQUEST", "Champs requis manquants : project_snapshot, script_target.script_id", 400);
    }

    // 5. Rate limiting (TODO Milestone 4 : implémentation complète avec KV)
    const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const limited = await checkRateLimit(clientIp, Number(env.RATE_LIMIT_RPM));
    if (limited) {
      return jsonError("RATE_LIMITED", "Trop de requêtes. Réessaie dans une minute.", 429);
    }

    // 6. Appel LLM (ou mock si header X-Mock: true)
    let rawJson: string;

    if (request.headers.get("X-Mock") === "true") {
      rawJson = JSON.stringify({
        script_id: body.script_target.script_id,
        beginner: {
          summary: "[MOCK] Ce script fait bouger le sprite de 10 pas.",
          walkthrough: [{ step: 1, what: "Le sprite avance de 10 pas.", blocks: ["motion_movesteps"] }],
          vocabulary: [{ term: "pas", definition: "Unité de distance dans Scratch." }],
        },
        risks: [],
        improvements: [],
        unknowns: [],
      });
    } else {
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      try {
        const completion = await client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 4096,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: buildUserMessage(body) },
          ],
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("Réponse OpenAI vide");
        rawJson = content;
      } catch (e) {
        return jsonError("LLM_ERROR", `Erreur OpenAI API : ${(e as Error).message}`, 502);
      }
    }

    // 7. Validation schéma JSON de sortie
    const validated = validateResponse(rawJson);
    if (!validated.success) {
      return jsonError(
        "SCHEMA_VALIDATION",
        `Réponse LLM hors schéma : ${validated.error}`,
        502
      );
    }

    return new Response(JSON.stringify(validated.data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};

function jsonError(code: ErrorResponse["error"], message: string, status: number): Response {
  const body: ErrorResponse = { error: code, message };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
