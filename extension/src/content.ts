// ============================================================
// content.ts — Point d'entrée du content script
// Injecté par Chrome dans scratch.mit.edu/projects/*/editor
// ============================================================
// MILESTONE 2 : injecter le bouton "Explain" dans l'éditeur
// MILESTONE 3 : extraire le snapshot via snapshot.ts
// MILESTONE 4 : envoyer au proxy via api.ts
// MILESTONE 5 : afficher le résultat via ui.ts
// ============================================================

import { extractSnapshot } from "./snapshot";
import { renderPanel } from "./ui";
import { explainScript } from "./api";

console.log("[ScratchExplainer] Extension chargée ✓");

// Scratch charge son UI de manière asynchrone (React).
// On attend que l'éditeur soit prêt avant d'injecter notre UI.
function waitForEditor(): Promise<Element> {
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      // TODO Milestone 2 : identifier le bon sélecteur CSS de l'éditeur Scratch
      const editor = document.querySelector(".blocklyToolboxDiv");
      if (editor) {
        observer.disconnect();
        resolve(editor);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

async function init(): Promise<void> {
  await waitForEditor();
  console.log("[ScratchExplainer] Éditeur détecté, injection UI...");

  // TODO Milestone 2 : injecter le bouton dans la toolbar Scratch
  // TODO Milestone 3 : au clic => appeler extractSnapshot()
  // TODO Milestone 4 : envoyer à explainScript()
  // TODO Milestone 5 : afficher avec renderPanel()
}

init().catch(console.error);
