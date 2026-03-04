// ============================================================
// popup.ts — Sauvegarde les réglages dans chrome.storage.local
// ============================================================
// chrome.storage.local = coffre-fort privé de l'extension.
// Stocké sur l'appareil de l'utilisateur uniquement.
// Jamais accessible par des sites web ni par GitHub.
// ============================================================

export interface Settings {
  token: string;
  workerUrl: string;
  language: "fr" | "en";
  modes: ("beginner" | "advanced")[];
  mockMode: boolean;
}

const DEFAULT_WORKER_URL =
  "https://scratch-explainer-worker.nampinanathali.workers.dev";

function getEl<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

async function load(): Promise<void> {
  const result = await chrome.storage.local.get("settings");
  const s: Partial<Settings> = result.settings ?? {};

  getEl<HTMLInputElement>("token").value = s.token ?? "";
  getEl<HTMLInputElement>("workerUrl").value = s.workerUrl ?? DEFAULT_WORKER_URL;
  getEl<HTMLSelectElement>("language").value = s.language ?? "fr";
  getEl<HTMLInputElement>("modeBeginner").checked =
    s.modes ? s.modes.includes("beginner") : true;
  getEl<HTMLInputElement>("modeAdvanced").checked =
    s.modes ? s.modes.includes("advanced") : false;
  getEl<HTMLInputElement>("mockMode").checked = s.mockMode ?? false;
}

async function save(): Promise<void> {
  const modes: Settings["modes"] = [];
  if (getEl<HTMLInputElement>("modeBeginner").checked) modes.push("beginner");
  if (getEl<HTMLInputElement>("modeAdvanced").checked) modes.push("advanced");

  const settings: Settings = {
    token:     getEl<HTMLInputElement>("token").value.trim(),
    workerUrl: getEl<HTMLInputElement>("workerUrl").value.trim() || DEFAULT_WORKER_URL,
    language:  getEl<HTMLSelectElement>("language").value as Settings["language"],
    modes:     modes.length > 0 ? modes : ["beginner"],
    mockMode:  getEl<HTMLInputElement>("mockMode").checked,
  };

  await chrome.storage.local.set({ settings });

  const status = getEl("status");
  status.textContent = "Enregistre.";
  setTimeout(() => { status.textContent = ""; }, 2000);
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  getEl("save").addEventListener("click", save);
});
