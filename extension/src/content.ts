// ============================================================
// content.ts — Milestone 2 : menu contextuel "Explain this script"
// ============================================================
// Basé sur la source scratch-blocks (github.com/scratchfoundation/scratch-blocks)
//
// Dans scratch-blocks, le menu contextuel fonctionne ainsi :
//   1. Clic droit → BlockSvg.showContextMenu_(e)
//   2. showContextMenu_ construit menuOptions[] (Duplicate, Delete, etc.)
//   3. Si le bloc a une méthode customContextMenu(menuOptions), elle est appelée
//      → c'est le point d'extension officiel pour ajouter des items
//   4. Blockly.ContextMenu.show(e, menuOptions) affiche le menu
//
// Notre approche : monkey-patcher showContextMenu_ pour injecter
// un customContextMenu temporaire sur chaque bloc au moment du clic droit.
// ============================================================

import { extractSnapshot, fetchProjectMeta } from "./snapshot";
import { getCached, setCached } from "./cache";
import type { Settings } from "./popup";
import type { ExplainRequest, ExplainResponse, ErrorResponse, AdvancedExplanation } from "scratch-explainer-shared";
import { renderPanel, showLoadingPanel, showErrorPanel } from "./ui";

// Demande les réglages à bridge.ts via postMessage (bridge a accès à chrome.storage)
function getSettings(): Promise<Partial<Settings>> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "SCRATCH_EXPLAINER_SETTINGS") return;
      window.removeEventListener("message", handler);
      resolve(event.data.settings ?? {});
    };
    window.addEventListener("message", handler);
    window.postMessage({ type: "SCRATCH_EXPLAINER_GET_SETTINGS" }, "*");
  });
}

console.log("[ScratchExplainer] Extension chargée ✓");

// ─── Types minimaux pour Blockly (scratch-blocks) ───────────

interface BlockSvg {
  id: string;
  type: string;                // ex: "event_whenflagclicked"
  isInFlyout: boolean;
  workspace: { options: { readOnly: boolean } };
  contextMenu: boolean;
  customContextMenu?: ((options: ContextMenuItem[]) => void) | null;
  getRootBlock(): BlockSvg;
  showContextMenu_(e: MouseEvent): void;
}

interface ScratchBlocksLib {
  BlockSvg: {
    prototype: BlockSvg & {
      showContextMenu_: (e: MouseEvent) => void;
    };
  };
}

interface ContextMenuItem {
  text: string;
  enabled: boolean;
  callback: () => void;
}

// ─── Étape 1 : trouver la clé React fiber sur un élément DOM ─

function getReactFiberKey(element: Element): string | null {
  return (
    Object.keys(element).find(
      (k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance")
    ) ?? null
  );
}

// ─── Étape 2 : trouver Blockly via les React fibers ──────────

async function getBlockly(): Promise<ScratchBlocksLib> {
  const wrapper = document.querySelector('[class*="gui_blocks-wrapper"]');
  if (!wrapper) throw new Error("Blocks wrapper introuvable");

  const fiberKey = getReactFiberKey(wrapper);
  if (!fiberKey) throw new Error("React fiber key introuvable");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fiber: any = (wrapper as any)[fiberKey];
  while (fiber) {
    if (fiber.stateNode?.ScratchBlocks) {
      return fiber.stateNode.ScratchBlocks as ScratchBlocksLib;
    }
    fiber = fiber.child;
  }

  throw new Error("ScratchBlocks introuvable dans l'arbre React");
}

// ─── Étape 3 : attendre que l'éditeur soit prêt ──────────────

function waitForBlocksWrapper(): Promise<Element> {
  return new Promise((resolve) => {
    const existing = document.querySelector('[class*="gui_blocks-wrapper"]');
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = document.querySelector('[class*="gui_blocks-wrapper"]');
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// ─── Étape 4 : injecter l'option dans le menu contextuel ─────
//
// On patch showContextMenu_ (la méthode qui construit le menu dans scratch-blocks).
// Avant d'appeler l'original, on pose un customContextMenu temporaire sur le bloc.
// scratch-blocks appelle customContextMenu(menuOptions) juste avant d'afficher,
// ce qui nous permet d'ajouter notre item proprement.

const PATCH_KEY = "__scratchExplainerPatched";

function injectContextMenu(ScratchBlocks: ScratchBlocksLib): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((ScratchBlocks.BlockSvg.prototype as any)[PATCH_KEY]) {
    console.log("[ScratchExplainer] Menu déjà injecté, rien à faire.");
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ScratchBlocks.BlockSvg.prototype as any)[PATCH_KEY] = true;

  const original = ScratchBlocks.BlockSvg.prototype.showContextMenu_;

  ScratchBlocks.BlockSvg.prototype.showContextMenu_ = function (
    this: BlockSvg,
    e: MouseEvent
  ): void {
    // Blocs dans la palette (flyout) → ne pas ajouter l'option
    if (this.isInFlyout) {
      original.call(this, e);
      return;
    }

    // Sauvegarder le customContextMenu existant (défini par le type de bloc)
    const prevCustom = this.customContextMenu ?? null;

    // Poser notre customContextMenu temporaire
    this.customContextMenu = (menuOptions: ContextMenuItem[]) => {
      // Appeler l'éventuel customContextMenu original du bloc
      if (prevCustom) prevCustom.call(this, menuOptions);

      // Ajouter notre option — format exact de scratch-blocks :
      // { text: string, enabled: boolean, callback: function }
      const rootBlock = this.getRootBlock();
      menuOptions.push({
        text: "Explain this script",
        enabled: true,
        callback: () => onExplainClicked(rootBlock),
      });
    };

    // Appeler showContextMenu_ original → construit le menu + appelle notre customContextMenu
    original.call(this, e);

    // Restaurer l'état d'origine
    this.customContextMenu = prevCustom;
  };

  console.log("[ScratchExplainer] Menu contextuel injecté ✓");
}

// ─── Étape 5 : callback quand l'utilisateur clique ───────────

// Titres par défaut Scratch à ignorer (pas utiles pour le LLM)
const DEFAULT_TITLE = /^Untitled(-\d+)?$/i;

async function onExplainClicked(rootBlock: BlockSvg): Promise<void> {
  console.log("[ScratchExplainer] Extraction du snapshot...");
  try {
    const { snapshot, spriteName, scriptId } = extractSnapshot(rootBlock.id);

    // Récupérer l'ID du projet depuis l'URL (ex: /projects/1286581785/editor)
    const projectId = window.location.pathname.match(/\/projects\/(\d+)/)?.[1];

    let fullSnapshot = snapshot;
    if (projectId) {
      const meta = await fetchProjectMeta(projectId);
      if (meta === null) {
        console.log("[ScratchExplainer] Métadonnées non disponibles (projet privé ou erreur réseau)");
      }
      if (meta) {
        const header: string[] = [];
        if (meta.title && !DEFAULT_TITLE.test(meta.title)) {
          header.push(`PROJECT: ${meta.title}`);
        }
        if (meta.instructions.trim()) {
          header.push(`INSTRUCTIONS: ${meta.instructions.trim()}`);
        }
        if (meta.notes.trim()) {
          header.push(`CREDITS: ${meta.notes.trim()}`);
        }
        if (header.length > 0) {
          fullSnapshot = header.join("\n") + "\n\n" + snapshot;
        }
      }
    }

    console.log("[ScratchExplainer] Snapshot extrait ✓");
    console.log("  → Sprite    :", spriteName);
    console.log("  → Script ID :", scriptId);

    // Lire les réglages via bridge.ts (qui a accès à chrome.storage)
    const settings = await getSettings();

    const token = settings.token ?? "";
    const workerUrl = (settings.workerUrl ?? "").replace(/\/$/, "");

    if (!token || !workerUrl) {
      showErrorPanel("Configure d'abord l'extension : clique sur l'icone dans la barre Chrome.");
      return;
    }

    const browserLang = navigator.language?.split("-")[0] ?? "fr";
    const modes = settings.modes ?? ["beginner"];

    // Vérifier le cache (clé basée sur le snapshot complet)
    const cached = await getCached(fullSnapshot, scriptId, modes, browserLang);
    if (cached) {
      console.log("[ScratchExplainer] Réponse depuis le cache ✓");
      renderPanel(cached);
      return;
    }

    // Si on demande le mode débutant, vérifier si l'avancé est déjà en cache
    // → dérivation avancé→débutant (moins de tokens que renvoyer tout le snapshot)
    let sourceAdvanced: AdvancedExplanation | undefined;
    if (!settings.mockMode && modes[0] === "beginner") {
      const cachedAdv = await getCached(fullSnapshot, scriptId, ["advanced"], browserLang);
      if (cachedAdv?.advanced) {
        sourceAdvanced = cachedAdv.advanced;
        console.log("[ScratchExplainer] Dérivation avancé→débutant ✓");
      }
    }

    // Si le snapshot dépasse 30 000 caractères, utiliser la version condensée
    // pour les sprites non ciblés (économie de tokens) — sauf si dérivation
    const CONDENSED_THRESHOLD = 30_000;
    let snapshotToSend = fullSnapshot;
    if (!sourceAdvanced && fullSnapshot.length > CONDENSED_THRESHOLD) {
      const { snapshot: condensed } = extractSnapshot(rootBlock.id, true);
      const metaEnd = fullSnapshot.indexOf("\n\nSPRITES:");
      const metaHeader = metaEnd !== -1 ? fullSnapshot.slice(0, metaEnd) : "";
      snapshotToSend = metaHeader ? metaHeader + "\n\n" + condensed : condensed;
      console.log(`[ScratchExplainer] Snapshot condensé : ${snapshotToSend.length} chars (vs ${fullSnapshot.length})`);
    }

    const payload: ExplainRequest = {
      project_snapshot: snapshotToSend,
      script_target: { sprite: spriteName, script_id: scriptId },
      modes,
      language: browserLang,
      ...(sourceAdvanced ? { source_advanced: sourceAdvanced } : {}),
    };

    showLoadingPanel();

    console.log("[ScratchExplainer] Envoi au worker...");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Client-Token": token,
    };
    if (settings.mockMode) headers["X-Mock"] = "true";

    const resp = await fetch(`${workerUrl}/explain`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const json = await resp.json() as ExplainResponse | ErrorResponse;

    if (!resp.ok) {
      const err = json as ErrorResponse;
      throw new Error(`Worker error ${err.error}: ${err.message}`);
    }

    const explanation = json as ExplainResponse;
    console.log("[ScratchExplainer] Réponse reçue ✓", explanation);

    // Sauvegarder dans le cache (jamais pour le mode mock)
    if (!settings.mockMode) {
      await setCached(fullSnapshot, scriptId, modes, browserLang, explanation);
    }

    renderPanel(explanation);
  } catch (err) {
    console.error("[ScratchExplainer] Erreur snapshot :", err);
    showErrorPanel("Erreur lors de l'extraction. Vois la console (F12).");
  }
}

// ─── Point d'entrée ───────────────────────────────────────────

function isEditorUrl(): boolean {
  return /\/projects\/\d+\/editor/.test(window.location.pathname);
}

async function init(): Promise<void> {
  if (!isEditorUrl()) return;
  try {
    await waitForBlocksWrapper();
    console.log("[ScratchExplainer] Éditeur détecté, recherche Blockly...");

    await new Promise((resolve) => setTimeout(resolve, 500));

    const ScratchBlocks = await getBlockly();
    console.log("[ScratchExplainer] Blockly trouvé ✓");

    injectContextMenu(ScratchBlocks);
  } catch (err) {
    console.error("[ScratchExplainer] Erreur initialisation :", err);
  }
}

// ─── Détection navigation SPA ─────────────────────────────────
//
// Scratch est une SPA (Single Page App) : naviguer entre /projects/ID
// et /projects/ID/editor ne recharge PAS la page → le content script
// ne se relance pas. On écoute history.pushState / replaceState pour
// détecter ces changements et relancer init() si nécessaire.

const _origPush = history.pushState.bind(history);
const _origReplace = history.replaceState.bind(history);

history.pushState = function (...args: Parameters<typeof history.pushState>) {
  _origPush(...args);
  init();
};
history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
  _origReplace(...args);
  init();
};
window.addEventListener("popstate", () => init());

// Lancement initial (si on arrive directement sur l'éditeur)
init();
