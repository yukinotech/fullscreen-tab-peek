const DEFAULT_SETTINGS = {
  enabled: true,
  placement: "top",
  triggerPercent: 10,
  sidePanelWidth: 220,
  topPanelHeight: 64,
  revealDelayMs: 70,
  hideDelayMs: 280
};

const LOG_PREFIX = "[Fullscreen Tab Peek:background]";

function log(event, details = {}) {
  console.log(LOG_PREFIX, event, details);
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(null);
  const settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...stored });
  log("settings:loaded", { stored, settings });
  return settings;
}

function normalizeSettings(settings) {
  const placement = ["top", "left", "right"].includes(settings.placement)
    ? settings.placement
    : "top";
  const triggerPercent = Number(settings.triggerPercent ?? DEFAULT_SETTINGS.triggerPercent);
  const sidePanelWidth = Number(settings.sidePanelWidth ?? DEFAULT_SETTINGS.sidePanelWidth);
  const topPanelHeight = Number(settings.topPanelHeight ?? DEFAULT_SETTINGS.topPanelHeight);

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    placement,
    triggerPercent: Math.min(30, Math.max(0.5, Number.isFinite(triggerPercent) ? triggerPercent : 10)),
    sidePanelWidth: Math.min(520, Math.max(220, Number.isFinite(sidePanelWidth) ? sidePanelWidth : 220)),
    topPanelHeight: Math.min(180, Math.max(64, Number.isFinite(topPanelHeight) ? topPanelHeight : 64))
  };
}

async function getPlatformOs() {
  const platform = await chrome.runtime.getPlatformInfo();
  log("platform:loaded", platform);
  return platform.os;
}

async function getWindowState(windowId) {
  log("window-state:request", { windowId });
  if (!Number.isInteger(windowId) || windowId === chrome.windows.WINDOW_ID_NONE) {
    const currentWindow = await chrome.windows.getCurrent();
    log("window-state:current", { state: currentWindow.state, id: currentWindow.id });
    return currentWindow.state;
  }

  const targetWindow = await chrome.windows.get(windowId);
  log("window-state:target", { state: targetWindow.state, id: targetWindow.id });
  return targetWindow.state;
}

async function getTabSnapshot(windowId) {
  const query = Number.isInteger(windowId) ? { windowId } : { currentWindow: true };
  const tabs = await chrome.tabs.query(query);
  const state = await getWindowState(windowId);
  log("tabs:snapshot", {
    query,
    windowState: state,
    fullscreen: state === "fullscreen",
    tabCount: tabs.length,
    activeTabId: tabs.find((tab) => tab.active)?.id
  });

  return {
    fullscreen: state === "fullscreen",
    tabs: tabs.map((tab) => ({
      id: tab.id,
      active: tab.active,
      title: tab.title || tab.url || "Untitled",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || ""
    }))
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log("message:received", {
    type: message?.type,
    senderTabId: sender.tab?.id,
    senderWindowId: sender.tab?.windowId
  });

  if (message?.type === "ftp:get-state") {
    Promise.all([getSettings(), getTabSnapshot(sender.tab?.windowId), getPlatformOs()])
      .then(([settings, snapshot, platformOs]) => {
        log("message:get-state:response", {
          fullscreen: snapshot.fullscreen,
          platformOs,
          placement: settings.placement,
          triggerPercent: settings.triggerPercent,
          sidePanelWidth: settings.sidePanelWidth,
          topPanelHeight: settings.topPanelHeight,
          enabled: settings.enabled,
          tabCount: snapshot.tabs.length
        });
        sendResponse({ settings, platformOs, ...snapshot });
      })
      .catch((error) => {
        log("message:get-state:error", { message: error.message });
        sendResponse({ error: error.message });
      });
    return true;
  }

  if (message?.type === "ftp:activate-tab" && Number.isInteger(message.tabId)) {
    log("tabs:activate", { tabId: message.tabId });
    chrome.tabs.update(message.tabId, { active: true });
  }

  if (message?.type === "ftp:update-settings") {
    const patch = {};
    if (Number.isFinite(message.sidePanelWidth)) {
      patch.sidePanelWidth = Math.min(520, Math.max(220, message.sidePanelWidth));
    }
    if (Number.isFinite(message.topPanelHeight)) {
      patch.topPanelHeight = Math.min(180, Math.max(64, message.topPanelHeight));
    }
    if (Object.keys(patch).length > 0) {
      log("settings:update", patch);
      chrome.storage.sync.set(patch);
    }
  }

  return false;
});

chrome.action.onClicked.addListener(() => {
  log("action:open-options");
  chrome.runtime.openOptionsPage();
});

async function notifyVisibleTabs() {
  const tabs = await chrome.tabs.query({});
  log("notify:start", { tabCount: tabs.length });
  for (const tab of tabs) {
    if (!tab.id || !tab.url || tab.url.startsWith("chrome://")) {
      log("notify:skip-tab", { tabId: tab.id, url: tab.url });
      continue;
    }
    chrome.tabs
      .sendMessage(tab.id, { type: "ftp:refresh" })
      .then(() => log("notify:sent", { tabId: tab.id, url: tab.url }))
      .catch((error) => log("notify:failed", { tabId: tab.id, url: tab.url, message: error.message }));
  }
}

chrome.tabs.onCreated.addListener(notifyVisibleTabs);
chrome.tabs.onRemoved.addListener(notifyVisibleTabs);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.title || changeInfo.favIconUrl || changeInfo.status === "complete") {
    notifyVisibleTabs();
  }
});
chrome.tabs.onActivated.addListener(notifyVisibleTabs);
chrome.windows.onFocusChanged.addListener(notifyVisibleTabs);
chrome.windows.onBoundsChanged?.addListener(notifyVisibleTabs);
chrome.storage.onChanged.addListener(notifyVisibleTabs);
