// ============================================================
// snapshot.ts — Extraction du projet Scratch en format TXT
// ============================================================
// Scratch expose son runtime via window._scratchGui ou window.vm
// selon la version. On accède au projet via vm.runtime.
//
// MILESTONE 3 : implémenter cette extraction
// ============================================================

// Type minimal pour le runtime Scratch (non exhaustif)
interface ScratchVM {
  runtime: {
    targets: ScratchTarget[];
  };
}

interface ScratchTarget {
  getName(): string;
  isStage: boolean;
  variables: Record<string, { name: string; value: unknown; type: string }>;
  lists: Record<string, { name: string; value: unknown[] }>;
  blocks: {
    _blocks: Record<string, ScratchBlock>;
  };
  costumes: Array<{ name: string }>;
  sounds: Array<{ name: string }>;
}

interface ScratchBlock {
  id: string;
  opcode: string;
  topLevel: boolean;
  next: string | null;
  inputs: Record<string, unknown>;
  fields: Record<string, unknown>;
}

/**
 * Récupère la VM Scratch depuis le contexte de la page.
 * Scratch ne l'expose pas directement — on doit la trouver
 * via l'élément React ou une propriété globale.
 */
function getScratchVM(): ScratchVM | null {
  // TODO Milestone 3 : détecter la bonne propriété selon la version Scratch
  // Pistes connues :
  //   - document.querySelector('[class^="gui_"]').__reactFiber...
  //   - window._scratchGui?.vm
  return null;
}

/**
 * Sérialise le projet Scratch en format TXT structuré (voir §2 du cahier des charges).
 * Ce texte est envoyé au LLM comme contexte.
 */
export function extractSnapshot(): string {
  const vm = getScratchVM();
  if (!vm) {
    throw new Error("VM Scratch non trouvée. Assurez-vous d'être dans l'éditeur.");
  }

  const lines: string[] = [];

  // TODO Milestone 3 : implémenter la sérialisation
  // Format cible (§2.2 du cahier des charges) :
  //
  //   PROJECT: <title>
  //   SPRITES: [Stage, Cat, ...]
  //   GLOBAL VARS: score, speed
  //   GLOBAL LISTS: enemies
  //   BROADCASTS: startGame, gameOver
  //
  //   SPRITE: Cat
  //   LOCAL VARS: id
  //   SCRIPTS:
  //   - SCRIPT_ID: Cat_2
  //     EVENT: whenGreenFlag
  //     BLOCKS:
  //     - set [score] to 0
  //     - forever ...

  lines.push("PROJECT: (TODO)");
  return lines.join("\n");
}
