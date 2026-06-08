const ROOT_ID = "fullscreen-tab-peek-root";

const state = {
  root: null,
  edge: null,
  panel: null,
  list: null,
  settings: null,
  fullscreen: false,
  hideTimer: 0,
  revealTimer: 0
};

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function isExtensionTargetAllowed() {
  return document.documentElement && !document.getElementById(ROOT_ID);
}

function setupDom() {
  if (!isExtensionTargetAllowed()) return;

  state.root = createElement("div", "ftp-root");
  state.root.id = ROOT_ID;

  state.edge = createElement("div", "ftp-edge");
  state.panel = createElement("aside", "ftp-panel");
  state.panel.setAttribute("aria-label", "Fullscreen tabs");
  state.list = createElement("div", "ftp-list");

  const header = createElement("div", "ftp-header");
  header.append(
    createElement("span", "ftp-title", "Tabs"),
    createElement("span", "ftp-hint", "edge hover")
  );

  state.panel.append(header, state.list);
  state.root.append(state.edge, state.panel);
  document.documentElement.appendChild(state.root);

  state.edge.addEventListener("mouseenter", scheduleReveal);
  state.panel.addEventListener("mouseenter", cancelHide);
  state.panel.addEventListener("mouseleave", scheduleHide);
}

function applySettings() {
  if (!state.root || !state.settings) return;

  state.root.dataset.side = state.settings.side;
  state.root.dataset.enabled = String(state.settings.enabled && state.fullscreen);
  state.edge.style.setProperty("--ftp-edge-width", `${state.settings.edgeWidth}px`);
}

function scheduleReveal() {
  window.clearTimeout(state.hideTimer);
  window.clearTimeout(state.revealTimer);
  state.revealTimer = window.setTimeout(() => {
    state.root?.classList.add("ftp-visible");
  }, state.settings?.revealDelayMs ?? 70);
}

function scheduleHide() {
  window.clearTimeout(state.hideTimer);
  state.hideTimer = window.setTimeout(() => {
    state.root?.classList.remove("ftp-visible");
  }, state.settings?.hideDelayMs ?? 280);
}

function cancelHide() {
  window.clearTimeout(state.hideTimer);
}

function renderTabs(tabs) {
  if (!state.list) return;

  state.list.replaceChildren();

  for (const tab of tabs) {
    const button = createElement("button", `ftp-tab${tab.active ? " is-active" : ""}`);
    button.type = "button";
    button.title = tab.title;
    button.dataset.tabId = String(tab.id);

    const favicon = createElement("span", "ftp-favicon");
    favicon.textContent = tab.title.slice(0, 1).toUpperCase();

    const text = createElement("span", "ftp-tab-title", tab.title);
    const close = createElement("span", "ftp-close", "x");
    close.setAttribute("aria-hidden", "true");

    button.append(favicon, text, close);
    button.addEventListener("click", (event) => {
      if (event.target === close) {
        chrome.runtime.sendMessage({ type: "ftp:close-tab", tabId: tab.id });
        return;
      }

      chrome.runtime.sendMessage({ type: "ftp:activate-tab", tabId: tab.id });
      scheduleHide();
    });

    state.list.append(button);
  }
}

async function refresh() {
  if (!state.root) return;

  const response = await chrome.runtime.sendMessage({ type: "ftp:get-state" });
  if (response?.error) throw new Error(response.error);

  state.settings = response.settings;
  state.fullscreen = Boolean(response.fullscreen);
  applySettings();
  renderTabs(response.tabs || []);
}

setupDom();
refresh().catch(() => {});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ftp:refresh") {
    refresh().catch(() => {});
  }
});
