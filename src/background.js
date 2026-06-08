const DEFAULT_SETTINGS = {
  enabled: true,
  side: "left",
  edgeWidth: 10,
  revealDelayMs: 70,
  hideDelayMs: 280
};

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function getWindowState(windowId) {
  if (!Number.isInteger(windowId) || windowId === chrome.windows.WINDOW_ID_NONE) {
    const currentWindow = await chrome.windows.getCurrent();
    return currentWindow.state;
  }

  const targetWindow = await chrome.windows.get(windowId);
  return targetWindow.state;
}

async function getTabSnapshot(windowId) {
  const query = Number.isInteger(windowId) ? { windowId } : { currentWindow: true };
  const tabs = await chrome.tabs.query(query);
  const state = await getWindowState(windowId);

  return {
    fullscreen: state === "fullscreen",
    tabs: tabs.map((tab) => ({
      id: tab.id,
      active: tab.active,
      title: tab.title || tab.url || "Untitled",
      url: tab.url || ""
    }))
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ftp:get-state") {
    Promise.all([getSettings(), getTabSnapshot(sender.tab?.windowId)])
      .then(([settings, snapshot]) => sendResponse({ settings, ...snapshot }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message?.type === "ftp:activate-tab" && Number.isInteger(message.tabId)) {
    chrome.tabs.update(message.tabId, { active: true });
  }

  if (message?.type === "ftp:close-tab" && Number.isInteger(message.tabId)) {
    chrome.tabs.remove(message.tabId);
  }

  return false;
});

async function notifyVisibleTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url || tab.url.startsWith("chrome://")) continue;
    chrome.tabs.sendMessage(tab.id, { type: "ftp:refresh" }).catch(() => {});
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
chrome.storage.onChanged.addListener(notifyVisibleTabs);
