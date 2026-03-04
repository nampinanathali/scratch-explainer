// ============================================================
// schema.ts — Validation Zod de la réponse LLM
// ============================================================
// Zod permet de définir un schéma TypeScript ET de valider
// les données à l'exécution. C'est le standard moderne.
// ============================================================

import { z } from "zod";
import type { ExplainResponse } from "scratch-explainer-shared";

// --- Schémas Zod (miroir des types TypeScript dans shared/types.ts) ---

const StepSchema = z.object({
  step: z.number().int().positive(),
  what: z.string(),
  blocks: z.array(z.string()),
});

const VocabItemSchema = z.object({
  term: z.string(),
  definition: z.string(),
});

const BeginnerSchema = z.object({
  summary: z.string(),
  walkthrough: z.array(StepSchema),
  vocabulary: z.array(VocabItemSchema),
});

const AdvancedSchema = z.object({
  summary: z.string(),
  control_flow: z.string(),
  state_changes: z.string(),
  event_dependencies: z.string(),
  timing_notes: z.string(),
  performance_notes: z.string(),
});

const RiskSchema = z.object({
  type: z.enum(["logic", "performance", "state", "event", "ui"]),
  severity: z.enum(["low", "medium", "high"]),
  detail: z.string(),
});

const ImprovementSchema = z.object({
  goal: z.enum(["readability", "robustness", "performance"]),
  suggestion: z.string(),
});

const ExplainResponseSchema = z.object({
  script_id: z.string(),
  beginner: BeginnerSchema.optional(),
  advanced: AdvancedSchema.optional(),
  risks: z.array(RiskSchema),
  improvements: z.array(ImprovementSchema),
  unknowns: z.array(z.string()),
});

// --- Résultat de validation ---

type ValidationSuccess = { success: true; data: ExplainResponse };
type ValidationFailure = { success: false; error: string };

/**
 * Parse et valide la chaîne JSON retournée par le LLM.
 * Le LLM peut parfois ajouter des backticks (```json ... ```) malgré
 * les instructions — on les nettoie avant de parser.
 */
export function validateResponse(raw: string): ValidationSuccess | ValidationFailure {
  // Nettoyage des éventuels code fences ajoutés par le LLM
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { success: false, error: `JSON.parse échoué : ${(e as Error).message}` };
  }

  const result = ExplainResponseSchema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  return { success: true, data: result.data as ExplainResponse };
}
