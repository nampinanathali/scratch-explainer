// ============================================================
// bridge.ts — Pont entre MAIN world et ISOLATED world
// ============================================================
// content.ts tourne dans le monde MAIN (accès à Scratch/JS de la page)
// mais n'a pas accès à chrome.storage.
//
// bridge.ts tourne dans le monde ISOLATED (accès à chrome.storage)
// mais n'a pas accès aux objets JavaScript de la page.
//
// Les deux se parlent via window.postMessage.
// ============================================================

window.addEventListener("message", async (event: MessageEvent) => {
  if (event.source !== window) return;
  if (event.data?.type !== "SCRATCH_EXPLAINER_GET_SETTINGS") return;

  const result = await chrome.storage.local.get("settings");
  window.postMessage(
    {
      type: "SCRATCH_EXPLAINER_SETTINGS",
      settings: result.settings ?? null,
    },
    "*"
  );
});
