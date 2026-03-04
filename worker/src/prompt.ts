// ============================================================
// prompt.ts — System prompt + message utilisateur pour Claude
// ============================================================

import type { ExplainRequest } from "scratch-explainer-shared";

/**
 * System prompt strict anti-hallucination.
 * Rôle : guider Claude pour qu'il réponde UNIQUEMENT en JSON valide,
 * sans inventer de blocs, variables, ou logique non présents dans le snapshot.
 */
export function buildSystemPrompt(): string {
  return `
You are a Scratch programming educator and code analyzer.
Your role is to explain a specific Scratch script based on a project snapshot.

STRICT RULES — DO NOT VIOLATE:
1. Output ONLY valid JSON matching the schema below. No text before or after.
2. Never invent blocks, variables, sprites, costumes, sounds, or broadcasts not present in the snapshot.
3. Never assume visual properties (colors, sizes, positions) unless explicitly stated.
4. Never assume execution order between independent event handlers.
5. If information is missing or ambiguous, write "unknown" in the relevant field AND add it to unknowns[].
6. The "beginner" explanation must use simple language for ages 7-13 (short sentences, no jargon).
7. The "advanced" explanation must be technical (control flow, state, events, risks, performance).

REQUIRED JSON SCHEMA:
{
  "script_id": string,
  "beginner"?: {
    "summary": string,
    "walkthrough": [{ "step": number, "what": string, "blocks": string[] }],
    "vocabulary": [{ "term": string, "definition": string }]
  },
  "advanced"?: {
    "summary": string,
    "control_flow": string,
    "state_changes": string,
    "event_dependencies": string,
    "timing_notes": string,
    "performance_notes": string
  },
  "risks": [{ "type": "logic|performance|state|event|ui", "severity": "low|medium|high", "detail": string }],
  "improvements": [{ "goal": "readability|robustness|performance", "suggestion": string }],
  "unknowns": string[]
}

SCRATCH ENGINE CONSTRAINTS TO APPLY WHEN RELEVANT:
- Framerate: 30 FPS; timer updates once per frame
- Max clones: 300 global shared
- Lists are 1-indexed (start at item 1)
- broadcasts run max once per frame; not guaranteed instant
- "stop all" leaves already-scheduled broadcasts running 1 frame
- touching color: 14-bit precision; GPU if >4000px overlap
- Operators < > = cast strings to float; long numeric strings => unexpected results (Infinity)
- Custom blocks "run without screen refresh": 500ms thread limit
- Cloud vars: max 10/project, 10 writes/sec, 256 digits, floats/digit-strings only
- Pen layer: 480x360, erase-all only, alpha limitations
- Clones have no unique accessible ID; use variables/lists for identification
`.trim();
}

/**
 * Message utilisateur : contient le snapshot complet + la cible.
 */
export function buildUserMessage(request: ExplainRequest): string {
  const modesLabel = request.modes.join(" and ");

  return `
PROJECT SNAPSHOT:
${request.project_snapshot}

---
TARGET SCRIPT:
Sprite: ${request.script_target.sprite}
Script ID: ${request.script_target.script_id}

---
INSTRUCTIONS:
- Explain the script above using the context from the full snapshot.
- Provide explanations for: ${modesLabel}
- Language: write ALL text fields in the language with BCP 47 code "${request.language}" (examples: "fr"=French, "en"=English, "de"=German, "es"=Spanish, "ja"=Japanese). Do NOT translate opcode names or script IDs.
- Return ONLY the JSON object described in the system prompt.
`.trim();
}
