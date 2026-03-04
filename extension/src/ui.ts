// ============================================================
// ui.ts — Panneau d'explication style Scratch (Milestone 5)
// ============================================================

import type { ExplainResponse } from "scratch-explainer-shared";

const OVERLAY_ID = "scratch-explainer-overlay";
const STYLES_ID  = "scratch-explainer-styles";

// ─── Sécurité : échappe le HTML pour éviter l'injection ─────
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Injection CSS (une seule fois) ──────────────────────────
function injectStyles(): void {
  if (document.getElementById(STYLES_ID)) return;
  const style = document.createElement("style");
  style.id = STYLES_ID;
  style.textContent = `
    #scratch-explainer-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 99999;
      font-family: "Helvetica Neue", sans-serif;
    }
    .se-modal {
      background: #fff;
      border-radius: 8px;
      width: 460px;
      max-height: 80vh;
      display: flex; flex-direction: column;
      font-size: 13px;
      color: #575E75;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    }
    .se-header {
      background: #4C97FF;
      color: #fff;
      padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between;
      font-size: 15px; font-weight: 600;
      flex-shrink: 0;
    }
    .se-close-x {
      background: rgba(255,255,255,0.25);
      border: none; border-radius: 50%;
      width: 26px; height: 26px;
      color: #fff; font-size: 15px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .se-close-x:hover { background: rgba(255,255,255,0.45); }
    .se-body { overflow-y: auto; padding: 16px; flex: 1; }
.se-section { margin-bottom: 18px; }
    .se-section-title {
      font-weight: 600; font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.6px;
      color: #4C97FF; margin-bottom: 8px;
    }
    .se-summary {
      background: #F9F9F9; border: 1px solid #E0E0E0;
      border-radius: 4px; padding: 10px 12px;
      line-height: 1.6; margin-bottom: 10px;
    }
    .se-step {
      display: flex; gap: 10px;
      padding: 7px 0; border-bottom: 1px solid #F0F0F0;
    }
    .se-step:last-child { border-bottom: none; }
    .se-step-num {
      min-width: 22px; height: 22px;
      background: #4C97FF; color: #fff;
      border-radius: 50%; font-size: 11px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 1px;
    }
    .se-step-text { line-height: 1.5; }
    .se-vocab-item { padding: 5px 0; line-height: 1.5; }
    .se-vocab-term { font-weight: 600; }
    .se-field { padding: 7px 0; border-bottom: 1px solid #F0F0F0; line-height: 1.5; }
    .se-field:last-child { border-bottom: none; }
    .se-field-label {
      font-weight: 600; font-size: 11px;
      color: #9966FF; margin-bottom: 3px;
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .se-badge {
      display: inline-block; padding: 1px 7px;
      border-radius: 3px; font-size: 11px; font-weight: 600;
      margin-right: 5px;
    }
    .se-badge-high   { background: #FFECEC; color: #FF6680; }
    .se-badge-medium { background: #FFF3E0; color: #FFAB19; }
    .se-badge-low    { background: #E8F5E9; color: #59C059; }
    .se-badge-type   { background: #F0F0F0; color: #575E75; }
    .se-badge-goal   { background: #EDE7F6; color: #9966FF; }
    .se-risk, .se-improvement {
      padding: 7px 0; border-bottom: 1px solid #F0F0F0; line-height: 1.5;
    }
    .se-risk:last-child, .se-improvement:last-child { border-bottom: none; }
    .se-unknown { padding: 4px 0; }
    .se-loading { text-align: center; padding: 36px; color: #9E9E9E; font-size: 14px; }
    .se-error   { color: #FF6680; padding: 20px; text-align: center; line-height: 1.6; }
  `;
  document.head.appendChild(style);
}

// ─── Overlay + modal (créé une fois, réutilisé) ──────────────

function getOrCreateOverlay(): HTMLElement {
  injectStyles();
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;

  const modal = document.createElement("div");
  modal.className = "se-modal";
  overlay.appendChild(modal);

  // Fermer en cliquant sur le fond sombre
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePanel();
  });

  document.body.appendChild(overlay);
  return overlay;
}

export function closePanel(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}

// ─── Rendu interne ────────────────────────────────────────────

function setModalContent(title: string, bodyHtml: string): void {
  const overlay = getOrCreateOverlay();
  const modal = overlay.querySelector(".se-modal") as HTMLElement;

  modal.innerHTML = `
    <div class="se-header">
      <span>${esc(title)}</span>
      <button class="se-close-x" aria-label="Fermer">&#x2715;</button>
    </div>
    <div class="se-body">${bodyHtml}</div>
  `;

  modal.querySelector(".se-close-x")?.addEventListener("click", closePanel);
}

// ─── API publique ─────────────────────────────────────────────

export function showLoadingPanel(): void {
  setModalContent(
    "Scratch Script Explainer",
    `<div class="se-loading">Analyse en cours...</div>`
  );
}

export function showErrorPanel(message: string): void {
  setModalContent("Scratch Script Explainer", `<div class="se-error">${esc(message)}</div>`);
}

export function renderPanel(response: ExplainResponse): void {
  const parts: string[] = [];

  // ── Mode débutant ────────────────────────────────────────────
  if (response.beginner) {
    const b = response.beginner;
    parts.push(`<div class="se-section">`);
    parts.push(`<div class="se-section-title">Explication debutant</div>`);
    parts.push(`<div class="se-summary">${esc(b.summary)}</div>`);

    if (b.walkthrough.length > 0) {
      parts.push(`<div class="se-section-title" style="margin-top:10px">Etapes</div>`);
      for (const step of b.walkthrough) {
        parts.push(`
          <div class="se-step">
            <div class="se-step-num">${step.step}</div>
            <div class="se-step-text">${esc(step.what)}</div>
          </div>`);
      }
    }

    if (b.vocabulary.length > 0) {
      parts.push(`<div class="se-section-title" style="margin-top:14px">Vocabulaire</div>`);
      for (const v of b.vocabulary) {
        parts.push(`<div class="se-vocab-item"><span class="se-vocab-term">${esc(v.term)}</span> : ${esc(v.definition)}</div>`);
      }
    }
    parts.push(`</div>`);
  }

  // ── Mode avancé ──────────────────────────────────────────────
  if (response.advanced) {
    const a = response.advanced;
    parts.push(`<div class="se-section">`);
    parts.push(`<div class="se-section-title">Explication avancee</div>`);
    parts.push(`<div class="se-summary">${esc(a.summary)}</div>`);

    const fields: [string, string][] = [
      ["Flux de controle",        a.control_flow],
      ["Changements d'etat",      a.state_changes],
      ["Dependances evenements",  a.event_dependencies],
      ["Notes timing",            a.timing_notes],
      ["Notes performance",       a.performance_notes],
    ];
    for (const [label, value] of fields) {
      if (value && value !== "unknown") {
        parts.push(`
          <div class="se-field">
            <div class="se-field-label">${label}</div>
            <div>${esc(value)}</div>
          </div>`);
      }
    }
    parts.push(`</div>`);
  }

  // ── Risques ──────────────────────────────────────────────────
  if (response.risks.length > 0) {
    parts.push(`<div class="se-section">`);
    parts.push(`<div class="se-section-title">Risques</div>`);
    for (const risk of response.risks) {
      parts.push(`
        <div class="se-risk">
          <span class="se-badge se-badge-${esc(risk.severity)}">${esc(risk.severity)}</span>
          <span class="se-badge se-badge-type">${esc(risk.type)}</span>
          ${esc(risk.detail)}
        </div>`);
    }
    parts.push(`</div>`);
  }

  // ── Améliorations ────────────────────────────────────────────
  if (response.improvements.length > 0) {
    parts.push(`<div class="se-section">`);
    parts.push(`<div class="se-section-title">Ameliorations suggereees</div>`);
    for (const imp of response.improvements) {
      parts.push(`
        <div class="se-improvement">
          <span class="se-badge se-badge-goal">${esc(imp.goal)}</span>
          ${esc(imp.suggestion)}
        </div>`);
    }
    parts.push(`</div>`);
  }

  // ── Inconnues ────────────────────────────────────────────────
  if (response.unknowns.length > 0) {
    parts.push(`<div class="se-section">`);
    parts.push(`<div class="se-section-title">Informations manquantes</div>`);
    for (const u of response.unknowns) {
      parts.push(`<div class="se-unknown">• ${esc(u)}</div>`);
    }
    parts.push(`</div>`);
  }

  setModalContent(`Script : ${response.script_id}`, parts.join(""));
}
