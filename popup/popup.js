const DEFAULT_SETTINGS = {
  enabled: true,
  side: "left",
  edgeWidth: 10,
  revealDelayMs: 70,
  hideDelayMs: 280
};

const enabled = document.querySelector("#enabled");
const left = document.querySelector("#left");
const right = document.querySelector("#right");
const edgeWidth = document.querySelector("#edgeWidth");
const edgeWidthValue = document.querySelector("#edgeWidthValue");

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  render({ ...DEFAULT_SETTINGS, ...settings });
}

function render(settings) {
  enabled.checked = settings.enabled;
  edgeWidth.value = String(settings.edgeWidth);
  edgeWidthValue.value = `${settings.edgeWidth}px edge trigger`;
  left.classList.toggle("is-active", settings.side === "left");
  right.classList.toggle("is-active", settings.side === "right");
}

async function updateSettings(patch) {
  await chrome.storage.sync.set(patch);
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  render({ ...DEFAULT_SETTINGS, ...settings });
}

enabled.addEventListener("change", () => updateSettings({ enabled: enabled.checked }));
left.addEventListener("click", () => updateSettings({ side: "left" }));
right.addEventListener("click", () => updateSettings({ side: "right" }));
edgeWidth.addEventListener("input", () => {
  updateSettings({ edgeWidth: Number(edgeWidth.value) });
});

loadSettings();
