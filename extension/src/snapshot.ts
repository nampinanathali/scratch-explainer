// ============================================================
// snapshot.ts — Milestone 3 : extraction du projet en TXT
// ============================================================
// IMPORTANT : les blocs en runtime scratch-vm utilisent des objets,
// pas des tableaux comme dans le format de fichier .sb3.
//
// Runtime fields  : { value: "score", id: "var_id" }
// Runtime inputs  : { block: "block_id", shadow: "shadow_id" }
// ============================================================

// ─── Types runtime scratch-vm ────────────────────────────────

interface ScratchVM {
  runtime: {
    targets: ScratchTarget[];
  };
}

interface ScratchVariable {
  name: string;
  value: unknown;
  type: string; // "" = scalaire, "list" = liste, "broadcast_msg" = message
}

interface ScratchTarget {
  getName(): string;
  isStage: boolean;
  variables: Record<string, ScratchVariable>;
  blocks: {
    _blocks: Record<string, ScratchBlock>;
  };
}

// En runtime, inputs = { block: id_du_bloc_connecté, shadow: id_du_bloc_fantôme }
interface ScratchBlockInput {
  name: string;
  block: string | null;
  shadow: string | null;
}

// En runtime, fields = { value: "la valeur", id: "id_variable_ou_null" }
interface ScratchBlockField {
  name: string;
  value: string;
  id?: string | null;
}

interface ScratchBlock {
  id: string;
  opcode: string;
  topLevel: boolean;
  next: string | null;
  parent: string | null;
  inputs: Record<string, ScratchBlockInput>;
  fields: Record<string, ScratchBlockField>;
  shadow: boolean;
  // Présent sur procedures_call, procedures_definition, procedures_prototype
  mutation?: {
    proccode?: string;  // ex: "MonBloc %s %b" — nom + types des paramètres
  };
}

// ─── Accès à la VM via React fiber ───────────────────────────

function getReactFiberKey(element: Element): string | null {
  return (
    Object.keys(element).find(
      (k) =>
        k.startsWith("__reactFiber") ||
        k.startsWith("__reactInternalInstance")
    ) ?? null
  );
}

export function getScratchVM(): ScratchVM | null {
  const wrapper = document.querySelector('[class*="gui_blocks-wrapper"]');
  if (!wrapper) return null;

  const fiberKey = getReactFiberKey(wrapper);
  if (!fiberKey) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fiber: any = (wrapper as any)[fiberKey];
  while (fiber) {
    if (fiber.stateNode?.props?.vm) {
      return fiber.stateNode.props.vm as ScratchVM;
    }
    fiber = fiber.child;
  }
  return null;
}

// ─── Sérialisation des blocs ─────────────────────────────────

/**
 * Résout la valeur d'un input.
 * Si un vrai reporter est connecté → sérialise ce bloc.
 * Sinon → lit la valeur du bloc fantôme (valeur par défaut).
 */
function getInputValue(
  input: ScratchBlockInput,
  blocks: Record<string, ScratchBlock>
): string {
  // Bloc reporter connecté (non-fantôme)
  const connectedBlock =
    input.block && blocks[input.block] && !blocks[input.block].shadow
      ? blocks[input.block]
      : null;

  if (connectedBlock) {
    return serializeReporter(connectedBlock, blocks);
  }

  // Bloc fantôme = valeur par défaut dans le champ input
  const shadowBlock = input.shadow ? blocks[input.shadow] : null;
  if (shadowBlock) {
    const vals = Object.values(shadowBlock.fields)
      .map((f) => f.value)
      .filter(Boolean);
    if (vals.length > 0) return vals.join(", ");
  }

  return "?";
}

/** Sérialise un bloc reporter (valeur retournée) en texte inline. */
function serializeReporter(
  block: ScratchBlock,
  blocks: Record<string, ScratchBlock>
): string {
  const fieldVals = Object.values(block.fields)
    .map((f) => f.value)
    .filter(Boolean);

  const inputVals = Object.entries(block.inputs)
    .filter(([k]) => !k.startsWith("SUBSTACK"))
    .map(([, v]) => getInputValue(v, blocks))
    .filter((v) => v !== "?" && v !== "");

  const params = [...fieldVals, ...inputVals].join(", ");
  return params ? `${block.opcode}(${params})` : block.opcode;
}

/** Sérialise un bloc instruction + ses substacks (corps de forever, if…). */
function serializeBlock(
  block: ScratchBlock,
  blocks: Record<string, ScratchBlock>,
  indent: number
): string[] {
  const pad = "  ".repeat(indent);
  const lines: string[] = [];

  // Custom blocks : le nom est dans mutation.proccode (ex: "MonBloc %s %b")
  // On remplace l'opcode générique "procedures_call" par le vrai nom
  if (
    (block.opcode === "procedures_call" || block.opcode === "procedures_definition") &&
    block.mutation?.proccode
  ) {
    const label = block.opcode === "procedures_call" ? "CALL" : "DEFINE";
    lines.push(`${pad}- ${label} custom_block[${block.mutation.proccode}]`);
    // Les substacks sont gérés plus bas (pour procedures_definition avec corps)
    for (let i = 1; ; i++) {
      const key = i === 1 ? "SUBSTACK" : `SUBSTACK${i}`;
      const subInput = block.inputs[key];
      if (!subInput) break;
      if (subInput.block && blocks[subInput.block]) {
        lines.push(...serializeSequence(subInput.block, blocks, indent + 1));
      }
    }
    return lines;
  }

  // Valeurs statiques du bloc (nom de variable, option choisie…)
  const fieldParts = Object.values(block.fields)
    .map((f) => f.value)
    .filter(Boolean)
    .map((v) => `[${v}]`);

  // Valeurs calculées (blocs reporters connectés, ou valeur par défaut)
  const inputParts = Object.entries(block.inputs)
    .filter(([k]) => !k.startsWith("SUBSTACK"))
    .map(([, v]) => getInputValue(v, blocks))
    .filter((v) => v !== "?" && v !== "");

  const params = [...fieldParts, ...inputParts].join(" ");
  lines.push(`${pad}- ${block.opcode}${params ? " " + params : ""}`);

  // Substacks : SUBSTACK = corps principal, SUBSTACK2 = branche else
  for (let i = 1; ; i++) {
    const key = i === 1 ? "SUBSTACK" : `SUBSTACK${i}`;
    const subInput = block.inputs[key];
    if (!subInput) break;

    if (i === 2) lines.push(`${pad}  [else]`);
    if (subInput.block && blocks[subInput.block]) {
      lines.push(...serializeSequence(subInput.block, blocks, indent + 1));
    }
  }

  return lines;
}

/** Suit la chaîne block.next et sérialise tous les blocs de la séquence. */
function serializeSequence(
  startId: string,
  blocks: Record<string, ScratchBlock>,
  indent: number
): string[] {
  const lines: string[] = [];
  let id: string | null = startId;
  while (id && blocks[id]) {
    const block: ScratchBlock = blocks[id];
    if (!block.shadow) lines.push(...serializeBlock(block, blocks, indent));
    id = block.next;
  }
  return lines;
}

// ─── Métadonnées du projet via l'API Scratch ──────────────────

export interface ProjectMeta {
  title: string;
  instructions: string; // champ "Instructions" dans l'éditeur Scratch
  notes: string;        // champ "Notes et Crédits" (= "description" dans l'API)
}

/**
 * Récupère les métadonnées du projet.
 *
 * Stratégie :
 * 1. Essai via l'API Scratch publique (fonctionne pour les projets partagés)
 * 2. Fallback : titre lu directement depuis le DOM de l'éditeur
 *    (fonctionne même pour les projets privés, mais sans description/notes)
 */
export async function fetchProjectMeta(
  projectId: string
): Promise<ProjectMeta | null> {
  let title = "";
  let instructions = "";
  let notes = "";

  // Essai API publique (projets partagés uniquement)
  try {
    const resp = await fetch(
      `https://api.scratch.mit.edu/projects/${projectId}`
    );
    if (resp.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await resp.json();
      title = String(json.title ?? "");
      instructions = String(json.instructions ?? "");
      notes = String(json.description ?? "");
    }
  } catch {
    // pas de réseau ou erreur CORS → on continue avec le fallback DOM
  }

  // Fallback DOM : titre visible dans la barre de menus de l'éditeur
  // Fonctionne pour les projets privés (pas besoin d'auth)
  if (!title) {
    const titleInput = document.querySelector(
      '[class*="title-field"]'
    ) as HTMLInputElement | null;
    title = titleInput?.value?.trim() ?? "";
  }

  if (!title) return null;
  return { title, instructions, notes };
}

// ─── Résultat ─────────────────────────────────────────────────

export interface SnapshotResult {
  snapshot: string;
  spriteName: string;
  scriptId: string;
}

// ─── Extraction principale ────────────────────────────────────

export function extractSnapshot(rootBlockId: string, condensedNonTarget = false): SnapshotResult {
  const vm = getScratchVM();
  if (!vm) {
    throw new Error(
      "VM Scratch non trouvée. Assure-toi d'être dans l'éditeur d'un projet."
    );
  }

  const targets = vm.runtime.targets;
  const lines: string[] = [];

  // Liste des sprites
  const spriteNames = targets.map((t) => t.getName());
  lines.push(`SPRITES: ${spriteNames.join(", ")}`);

  // Variables et listes globales (appartiennent au Stage)
  const stage = targets.find((t) => t.isStage);
  if (stage) {
    const gVars = Object.values(stage.variables)
      .filter((v) => v.type === "" || !v.type)
      .map((v) => `${v.name}=${JSON.stringify(v.value)}`);
    if (gVars.length) lines.push(`GLOBAL VARS: ${gVars.join(", ")}`);

    const gLists = Object.values(stage.variables)
      .filter((v) => v.type === "list")
      .map((v) => `${v.name}[${(v.value as unknown[]).length} items]`);
    if (gLists.length) lines.push(`GLOBAL LISTS: ${gLists.join(", ")}`);
  }

  // Broadcasts : collecte tous les noms de messages dans tout le projet
  const broadcastNames = new Set<string>();
  for (const target of targets) {
    for (const block of Object.values(target.blocks._blocks)) {
      // Hat "when I receive X" → champ BROADCAST_OPTION
      if (block.opcode === "event_whenbroadcastreceived") {
        const val = block.fields["BROADCAST_OPTION"]?.value;
        if (val) broadcastNames.add(val);
      }
      // Bloc "broadcast X" ou "broadcast X and wait" → input → shadow → champ
      if (block.opcode === "event_broadcast" || block.opcode === "event_broadcastandwait") {
        const inputRef = block.inputs["BROADCAST_INPUT"];
        if (inputRef?.shadow) {
          const shadow = target.blocks._blocks[inputRef.shadow];
          const val = shadow?.fields["BROADCAST_OPTION"]?.value;
          if (val) broadcastNames.add(val);
        }
      }
    }
  }
  if (broadcastNames.size > 0) {
    lines.push(`BROADCASTS: ${[...broadcastNames].join(", ")}`);
  }

  lines.push("");

  // Identifier quel sprite contient le script cible
  let foundSpriteName = "Unknown";
  let foundScriptId = `script_${rootBlockId.slice(0, 6)}`;
  for (const target of targets) {
    if (target.blocks._blocks[rootBlockId]) {
      foundSpriteName = target.getName();
      foundScriptId = `${foundSpriteName}_${rootBlockId.slice(0, 6)}`;
      break;
    }
  }

  // Sérialiser chaque sprite
  for (const target of targets) {
    const name = target.getName();
    lines.push(`SPRITE: ${name}`);

    // Le Stage n'a pas de vars locales — déjà listées en GLOBAL VARS
    if (!target.isStage) {
      const lVars = Object.values(target.variables)
        .filter((v) => v.type === "" || !v.type)
        .map((v) => v.name);
      if (lVars.length) lines.push(`  LOCAL VARS: ${lVars.join(", ")}`);

      const lLists = Object.values(target.variables)
        .filter((v) => v.type === "list")
        .map((v) => v.name);
      if (lLists.length) lines.push(`  LOCAL LISTS: ${lLists.join(", ")}`);
    }

    const allBlocks = target.blocks._blocks;
    const isTargetSprite = !!allBlocks[rootBlockId];
    const hatBlocks = Object.values(allBlocks).filter(
      (b) => b.topLevel && !b.shadow
    );

    if (hatBlocks.length) {
      lines.push("  SCRIPTS:");

      if (condensedNonTarget && !isTargetSprite) {
        // Sprite non ciblé + mode condensé : juste les événements déclencheurs
        for (const hat of hatBlocks) {
          const hatFields = Object.values(hat.fields)
            .map((f) => f.value)
            .filter(Boolean);
          const eventParam = hatFields.length ? ` [${hatFields.join(", ")}]` : "";
          lines.push(`    - ${hat.opcode}${eventParam}`);
        }
      } else {
        // Sprite ciblé ou mode complet : sérialisation complète
        for (const hat of hatBlocks) {
          const sid = `${name}_${hat.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6)}`;
          const isTarget = hat.id === rootBlockId;
          lines.push(`  - SCRIPT_ID: ${sid}${isTarget ? " [TARGET]" : ""}`);
          lines.push(`    EVENT: ${hat.opcode}`);

          const hatFields = Object.values(hat.fields)
            .map((f) => f.value)
            .filter(Boolean);
          if (hatFields.length) {
            lines.push(`    EVENT_PARAM: ${hatFields.join(", ")}`);
          }

          lines.push("    BLOCKS:");
          let hasContent = false;
          // Contenu interne du bloc chapeau (ex: forever seul, repeat seul)
          for (let j = 1; ; j++) {
            const key = j === 1 ? "SUBSTACK" : `SUBSTACK${j}`;
            const sub = hat.inputs[key];
            if (!sub) break;
            if (j === 2) lines.push("      [else]");
            if (sub.block && allBlocks[sub.block]) {
              hasContent = true;
              lines.push(...serializeSequence(sub.block, allBlocks, 4));
            }
          }
          // Blocs qui suivent le chapeau
          if (hat.next) {
            hasContent = true;
            lines.push(...serializeSequence(hat.next, allBlocks, 3));
          }
          if (!hasContent) lines.push("      (script vide)");
        }
      }
    }

    lines.push("");
  }

  return {
    snapshot: lines.join("\n"),
    spriteName: foundSpriteName,
    scriptId: foundScriptId,
  };
}
