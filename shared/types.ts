// ============================================================
// TYPES PARTAGÉS — Extension <-> Worker <-> LLM
// ============================================================
// Ce fichier est la source de vérité pour les structures JSON.
// Modifie ici => les deux côtés (extension + worker) en bénéficient.

// --------------------
// REQUÊTE (extension => worker)
// --------------------

export interface ScriptTarget {
  sprite: string;    // ex: "Cat"
  script_id: string; // ex: "Cat_2"
}

export interface ExplainRequest {
  project_snapshot: string;             // texte TXT du snapshot (voir cahier des charges §2)
  script_target: ScriptTarget;
  modes: ("beginner" | "advanced")[];   // un ou les deux
  language: string;                     // ex: "fr", "en"
}

// --------------------
// RÉPONSE (worker => extension, vient du LLM)
// --------------------

export interface Step {
  step: number;
  what: string;
  blocks: string[];
}

export interface VocabItem {
  term: string;
  definition: string;
}

export interface BeginnerExplanation {
  summary: string;
  walkthrough: Step[];
  vocabulary: VocabItem[];
}

export interface AdvancedExplanation {
  summary: string;
  control_flow: string;
  state_changes: string;
  event_dependencies: string;
  timing_notes: string;
  performance_notes: string;
}

export type RiskType = "logic" | "performance" | "state" | "event" | "ui";
export type Severity = "low" | "medium" | "high";
export type ImprovementGoal = "readability" | "robustness" | "performance";

export interface Risk {
  type: RiskType;
  severity: Severity;
  detail: string;
}

export interface Improvement {
  goal: ImprovementGoal;
  suggestion: string;
}

export interface ExplainResponse {
  script_id: string;
  beginner?: BeginnerExplanation;   // présent si "beginner" dans modes
  advanced?: AdvancedExplanation;   // présent si "advanced" dans modes
  risks: Risk[];
  improvements: Improvement[];
  unknowns: string[];               // infos manquantes détectées par le LLM
}

// --------------------
// ERREUR STRUCTURÉE (worker => extension en cas d'échec)
// --------------------

export type ErrorCode =
  | "PAYLOAD_TOO_LARGE"   // > 1 MB
  | "RATE_LIMITED"         // trop de requêtes
  | "INVALID_REQUEST"      // JSON malformé ou champ manquant
  | "LLM_ERROR"            // erreur Claude API
  | "SCHEMA_VALIDATION"    // réponse LLM hors schéma
  | "UNAUTHORIZED";        // token invalide/absent

export interface ErrorResponse {
  error: ErrorCode;
  message: string;
}
