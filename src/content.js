const ROOT_ID = "fullscreen-tab-peek-root";
const LOG_PREFIX = "[Fullscreen Tab Peek:content]";

const state = {
  root: null,
  edge: null,
  panel: null,
  resizeHandle: null,
  resizeBadge: null,
  list: null,
  settings: null,
  platformOs: "unknown",
  fullscreen: false,
  hideTimer: 0,
  revealTimer: 0,
  resizeTimer: 0,
  drag: null
};

function log(event, details = {}) {
  console.log(LOG_PREFIX, event, details);
}

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
  log("script:loaded", {
    url: location.href,
    readyState: document.readyState,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    screen: { width: screen.width, height: screen.height },
    existingRoot: Boolean(document.getElementById(ROOT_ID))
  });

  if (!isExtensionTargetAllowed()) {
    log("dom:setup:skipped", {
      hasDocumentElement: Boolean(document.documentElement),
      existingRoot: Boolean(document.getElementById(ROOT_ID))
    });
    return;
  }

  state.root = createElement("div", "ftp-root");
  state.root.id = ROOT_ID;

  state.edge = createElement("div", "ftp-edge");
  state.panel = createElement("aside", "ftp-panel");
  state.panel.setAttribute("aria-label", "Fullscreen tabs");
  state.resizeHandle = createElement("button", "ftp-resize-handle");
  state.resizeHandle.type = "button";
  state.resizeHandle.title = "Drag to resize. Double-click to reset.";
  state.resizeHandle.setAttribute("aria-label", "Resize tab drawer");
  state.resizeBadge = createElement("span", "ftp-resize-badge");
  state.list = createElement("div", "ftp-list");

  const header = createElement("div", "ftp-header");
  header.append(
    createElement("span", "ftp-title", "Tabs"),
    createElement("span", "ftp-hint", "edge hover")
  );

  state.panel.append(header, state.list, state.resizeHandle, state.resizeBadge);
  state.root.append(state.edge, state.panel);
  document.documentElement.appendChild(state.root);

  state.edge.addEventListener("mouseenter", scheduleReveal);
  state.panel.addEventListener("mouseenter", cancelHide);
  state.panel.addEventListener("mouseleave", scheduleHide);
  state.resizeHandle.addEventListener("pointerdown", startResize);
  state.resizeHandle.addEventListener("dblclick", resetDrawerSize);
  log("dom:setup:complete");
}

function applySettings() {
  if (!state.root || !state.settings) {
    log("settings:apply:skipped", {
      hasRoot: Boolean(state.root),
      hasSettings: Boolean(state.settings)
    });
    return;
  }

  const viewportFullscreen = isViewportFullscreen();
  const pageFullscreen = isPageFullscreen();
  const isWindows = state.platformOs === "win";
  const immersiveFullscreen = state.fullscreen || viewportFullscreen;
  const enabled = state.settings.enabled && isWindows && immersiveFullscreen && !pageFullscreen;

  state.root.dataset.placement = state.settings.placement;
  state.root.dataset.enabled = String(enabled);
  state.root.dataset.platform = state.platformOs;
  state.root.style.setProperty("--ftp-trigger-block", `${state.settings.triggerPercent}vh`);
  state.root.style.setProperty("--ftp-trigger-inline", `${state.settings.triggerPercent}vw`);
  state.root.style.setProperty("--ftp-side-panel-width", `${state.settings.sidePanelWidth}px`);
  state.root.style.setProperty("--ftp-top-panel-height", `${state.settings.topPanelHeight}px`);
  log("settings:applied", {
    enabled,
    extensionEnabled: state.settings.enabled,
    platformOs: state.platformOs,
    isWindows,
    immersiveFullscreen,
    pageFullscreen,
    backgroundFullscreen: state.fullscreen,
    viewportFullscreen,
    placement: state.settings.placement,
    triggerPercent: state.settings.triggerPercent,
    sidePanelWidth: state.settings.sidePanelWidth,
    topPanelHeight: state.settings.topPanelHeight,
    triggerBlock: `${state.settings.triggerPercent}vh`,
    triggerInline: `${state.settings.triggerPercent}vw`
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sizeForPlacement(placement) {
  if (placement === "top") {
    return {
      value: state.settings?.topPanelHeight ?? 64,
      min: 64,
      max: 180,
      cssVar: "--ftp-top-panel-height",
      storageKey: "topPanelHeight"
    };
  }

  return {
    value: state.settings?.sidePanelWidth ?? 220,
    min: 220,
    max: 520,
    cssVar: "--ftp-side-panel-width",
    storageKey: "sidePanelWidth"
  };
}

function setDrawerSize(value, persist = false) {
  if (!state.root || !state.settings) return;

  const placement = state.settings.placement;
  const size = sizeForPlacement(placement);
  const nextValue = Math.round(clamp(value, size.min, size.max));
  state.settings[size.storageKey] = nextValue;
  state.root.style.setProperty(size.cssVar, `${nextValue}px`);
  showResizeBadge(nextValue);

  log("resize:size-set", {
    placement,
    value: nextValue,
    persist,
    storageKey: size.storageKey
  });

  if (persist) {
    chrome.runtime.sendMessage({ type: "ftp:update-settings", [size.storageKey]: nextValue });
  }
}

function showResizeBadge(value) {
  if (!state.resizeBadge) return;
  state.resizeBadge.textContent = `${value}px`;
  state.resizeBadge.classList.add("is-visible");
}

function hideResizeBadge() {
  state.resizeBadge?.classList.remove("is-visible");
}

function startResize(event) {
  if (!state.settings || event.button !== 0) return;

  event.preventDefault();
  event.stopPropagation();
  window.clearTimeout(state.hideTimer);

  const placement = state.settings.placement;
  const size = sizeForPlacement(placement);
  state.drag = {
    placement,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startSize: size.value
  };

  state.root?.classList.add("ftp-resizing");
  state.resizeHandle?.setPointerCapture(event.pointerId);
  showResizeBadge(size.value);

  log("resize:start", state.drag);
}

function moveResize(event) {
  if (!state.drag) return;

  const delta =
    state.drag.placement === "top"
      ? event.clientY - state.drag.startY
      : state.drag.placement === "left"
        ? event.clientX - state.drag.startX
        : state.drag.startX - event.clientX;

  setDrawerSize(state.drag.startSize + delta, false);
}

function endResize(event) {
  if (!state.drag) return;

  const placement = state.drag.placement;
  const size = sizeForPlacement(placement);
  const value = state.settings?.[size.storageKey] ?? size.value;

  state.resizeHandle?.releasePointerCapture?.(state.drag.pointerId);
  state.root?.classList.remove("ftp-resizing");
  setDrawerSize(value, true);
  window.setTimeout(hideResizeBadge, 500);

  log("resize:end", {
    placement,
    pointerId: event.pointerId,
    value
  });
  state.drag = null;
}

function resetDrawerSize(event) {
  event.preventDefault();
  event.stopPropagation();
  if (!state.settings) return;

  const placement = state.settings.placement;
  const value = placement === "top" ? 64 : 220;
  setDrawerSize(value, true);
  window.setTimeout(hideResizeBadge, 500);
  log("resize:reset", { placement, value });
}

function isViewportFullscreen() {
  const widthGap = Math.abs(window.innerWidth - screen.width);
  const heightGap = Math.abs(window.innerHeight - screen.height);
  const fullscreen = widthGap <= 2 && heightGap <= 2;
  log("fullscreen:viewport-check", {
    fullscreen,
    widthGap,
    heightGap,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    screen: { width: screen.width, height: screen.height }
  });
  return fullscreen;
}

function isPageFullscreen() {
  const fullscreenElement =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement;
  const pageFullscreen = Boolean(fullscreenElement);
  log("fullscreen:page-check", {
    pageFullscreen,
    elementTag: fullscreenElement?.tagName,
    elementId: fullscreenElement?.id || "",
    elementClass: typeof fullscreenElement?.className === "string" ? fullscreenElement.className : ""
  });
  return pageFullscreen;
}

function scheduleReveal() {
  log("trigger:mouseenter", {
    enabled: state.root?.dataset.enabled,
    placement: state.root?.dataset.placement,
    visible: state.root?.classList.contains("ftp-visible")
  });
  window.clearTimeout(state.hideTimer);
  window.clearTimeout(state.revealTimer);
  state.revealTimer = window.setTimeout(() => {
    state.root?.classList.add("ftp-visible");
    const panelRect = state.panel?.getBoundingClientRect();
    const panelStyle = state.panel ? getComputedStyle(state.panel) : null;
    log("drawer:shown", {
      enabled: state.root?.dataset.enabled,
      placement: state.root?.dataset.placement,
      rootClass: state.root?.className,
      panelRect: panelRect
        ? {
            x: panelRect.x,
            y: panelRect.y,
            width: panelRect.width,
            height: panelRect.height
          }
        : null,
      panelStyle: panelStyle
        ? {
            display: panelStyle.display,
            opacity: panelStyle.opacity,
            visibility: panelStyle.visibility,
            transform: panelStyle.transform,
            zIndex: panelStyle.zIndex
          }
        : null
    });
  }, state.settings?.revealDelayMs ?? 70);
}

function scheduleHide() {
  log("drawer:mouseleave", {
    visible: state.root?.classList.contains("ftp-visible")
  });
  window.clearTimeout(state.hideTimer);
  state.hideTimer = window.setTimeout(() => {
    state.root?.classList.remove("ftp-visible");
    log("drawer:hidden");
  }, state.settings?.hideDelayMs ?? 280);
}

function cancelHide() {
  window.clearTimeout(state.hideTimer);
  log("drawer:mouseenter", {
    visible: state.root?.classList.contains("ftp-visible")
  });
}

function renderTabs(tabs) {
  if (!state.list) {
    log("tabs:render:skipped", { reason: "missing-list" });
    return;
  }

  state.list.replaceChildren();
  log("tabs:render:start", {
    tabCount: tabs.length,
    activeTabId: tabs.find((tab) => tab.active)?.id
  });

  for (const tab of tabs) {
    const button = createElement("button", `ftp-tab${tab.active ? " is-active" : ""}`);
    button.type = "button";
    button.title = tab.title;
    button.dataset.tabId = String(tab.id);

    const favicon = createElement("span", "ftp-favicon");
    if (tab.favIconUrl) {
      const image = createElement("img", "ftp-favicon-image");
      image.src = tab.favIconUrl;
      image.alt = "";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => {
        favicon.textContent = tab.title.slice(0, 1).toUpperCase();
        image.remove();
      });
      favicon.append(image);
    } else {
      favicon.textContent = tab.title.slice(0, 1).toUpperCase();
    }

    const text = createElement("span", "ftp-tab-title", tab.title);

    button.append(favicon, text);
    button.addEventListener("click", () => {
      log("tabs:activate:click", {
        tabId: tab.id,
        title: tab.title,
        active: tab.active
      });
      chrome.runtime.sendMessage({ type: "ftp:activate-tab", tabId: tab.id });
      scheduleHide();
    });

    state.list.append(button);
  }
  log("tabs:render:complete");
}

async function refresh() {
  if (!state.root) {
    log("refresh:skipped", { reason: "missing-root" });
    return;
  }

  log("refresh:start");
  const response = await chrome.runtime.sendMessage({ type: "ftp:get-state" });
  if (response?.error) {
    log("refresh:error", { message: response.error });
    throw new Error(response.error);
  }

  state.settings = response.settings;
  state.platformOs = response.platformOs || "unknown";
  state.fullscreen = Boolean(response.fullscreen);
  log("refresh:received", {
    fullscreen: state.fullscreen,
    platformOs: state.platformOs,
    settings: state.settings,
    tabCount: response.tabs?.length ?? 0
  });
  applySettings();
  renderTabs(response.tabs || []);
}

setupDom();
refresh().catch(() => {});

window.addEventListener("resize", () => {
  log("window:resize", {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    screen: { width: screen.width, height: screen.height }
  });
  window.clearTimeout(state.resizeTimer);
  state.resizeTimer = window.setTimeout(() => {
    log("window:resize:refresh");
    if (state.settings) applySettings();
    refresh().catch(() => {});
  }, 120);
});

window.addEventListener("pointermove", moveResize);
window.addEventListener("pointerup", endResize);
window.addEventListener("pointercancel", endResize);

for (const eventName of ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"]) {
  document.addEventListener(eventName, () => {
    log("fullscreen:event", { eventName });
    if (state.settings) applySettings();
  });
}

chrome.runtime.onMessage.addListener((message) => {
  log("message:received", { type: message?.type });
  if (message?.type === "ftp:refresh") {
    refresh().catch(() => {});
  }
});
