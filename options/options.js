const DEFAULT_SETTINGS = {
  enabled: true,
  placement: "top",
  triggerPercent: 10,
  sidePanelWidth: 220,
  topPanelHeight: 64,
  revealDelayMs: 70,
  hideDelayMs: 280
};

const LOG_PREFIX = "[Fullscreen Tab Peek:options]";

function log(event, details = {}) {
  console.log(LOG_PREFIX, event, details);
}

const enabled = document.querySelector("#enabled");
const placementButtons = [...document.querySelectorAll("[data-placement]")];
const triggerButtons = [...document.querySelectorAll("[data-trigger]")];
const triggerPercent = document.querySelector("#triggerPercent");

function normalizeSettings(settings) {
  const placement = ["top", "left", "right"].includes(settings.placement)
    ? settings.placement
    : "top";
  const rawTrigger = Number(settings.triggerPercent);
  const sidePanelWidth = Number(settings.sidePanelWidth);
  const topPanelHeight = Number(settings.topPanelHeight);

  const normalized = {
    ...DEFAULT_SETTINGS,
    ...settings,
    placement,
    triggerPercent: clampTrigger(rawTrigger),
    sidePanelWidth: Math.min(520, Math.max(220, Number.isFinite(sidePanelWidth) ? sidePanelWidth : 220)),
    topPanelHeight: Math.min(180, Math.max(64, Number.isFinite(topPanelHeight) ? topPanelHeight : 64))
  };
  log("settings:normalized", { input: settings, normalized });
  return normalized;
}

function clampTrigger(value) {
  if (!Number.isFinite(value)) return 10;
  const roundedToHalf = Math.round(value * 2) / 2;
  return Math.min(30, Math.max(0.5, roundedToHalf));
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(null);
  log("settings:load", { stored });
  render(normalizeSettings({ ...DEFAULT_SETTINGS, ...stored }));
}

function render(settings) {
  log("render", settings);
  enabled.checked = settings.enabled;
  triggerPercent.value = String(settings.triggerPercent);

  for (const button of placementButtons) {
    button.classList.toggle("is-active", button.dataset.placement === settings.placement);
  }

  for (const button of triggerButtons) {
    button.classList.toggle("is-active", Number(button.dataset.trigger) === settings.triggerPercent);
  }
}

async function updateSettings(patch) {
  const stored = await chrome.storage.sync.get(null);
  const current = normalizeSettings({ ...DEFAULT_SETTINGS, ...stored });
  const next = normalizeSettings({ ...current, ...patch });
  log("settings:update", { patch, current, next });
  await chrome.storage.sync.set({
    enabled: next.enabled,
    placement: next.placement,
    triggerPercent: next.triggerPercent,
    sidePanelWidth: next.sidePanelWidth,
    topPanelHeight: next.topPanelHeight,
    revealDelayMs: next.revealDelayMs,
    hideDelayMs: next.hideDelayMs
  });
  render(next);
}

enabled.addEventListener("change", () => updateSettings({ enabled: enabled.checked }));

for (const button of placementButtons) {
  button.addEventListener("click", () => updateSettings({ placement: button.dataset.placement }));
}

for (const button of triggerButtons) {
  button.addEventListener("click", () => updateSettings({ triggerPercent: Number(button.dataset.trigger) }));
}

triggerPercent.addEventListener("change", () => {
  updateSettings({ triggerPercent: clampTrigger(Number(triggerPercent.value)) });
});

loadSettings();
