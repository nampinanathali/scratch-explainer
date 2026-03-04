// ============================================================
// ui.ts — Panneau de rendu des explications dans l'éditeur
// ============================================================
// MILESTONE 5 : implémenter le rendu HTML du panneau
// ============================================================

import type { ExplainResponse } from "scratch-explainer-shared";

/**
 * Crée et affiche le panneau d'explication dans l'éditeur Scratch.
 * Si le panneau existe déjà, met à jour son contenu.
 */
export function renderPanel(response: ExplainResponse): void {
  const PANEL_ID = "scratch-explainer-panel";

  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = createPanel();
    document.body.appendChild(panel);
  }

  panel.innerHTML = buildHTML(response);
}

function createPanel(): HTMLElement {
  const panel = document.createElement("div");
  panel.id = "scratch-explainer-panel";

  // TODO Milestone 5 : styles inline ou stylesheet injectée
  Object.assign(panel.style, {
    position: "fixed",
    right: "16px",
    top: "80px",
    width: "340px",
    maxHeight: "80vh",
    overflowY: "auto",
    background: "#fff",
    border: "2px solid #4C97FF",
    borderRadius: "8px",
    padding: "16px",
    zIndex: "9999",
    fontFamily: "sans-serif",
    fontSize: "14px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
  });

  return panel;
}

function buildHTML(response: ExplainResponse): string {
  const parts: string[] = [];

  parts.push(`<h3 style="margin:0 0 12px;color:#4C97FF">Script : ${response.script_id}</h3>`);

  // TODO Milestone 5 : rendu beginner, advanced, risks, improvements
  parts.push("<p><em>(Explication à implémenter au Milestone 5)</em></p>");

  return parts.join("");
}
