# Fullscreen Tab Peek

Fullscreen Tab Peek is a small Chrome extension that brings back a quick tab switcher while Chrome is in fullscreen. Move the mouse to the top, left, or right screen edge and a compact, PotPlayer-style tab strip slides out over the page.

## Features

- Edge hover reveal while the current Chrome window is fullscreen.
- Top, left, or right drawer placement.
- Configurable trigger area as a viewport percentage.
- Drag the drawer edge to resize it directly; double-click the edge to reset.
- Shows tab favicons when Chrome exposes them.
- Live list of tabs in the current window.
- Click a tab to activate it.
- Lightweight Manifest V3 extension with no build step.
- No remote code, no analytics, and no network calls from the extension package.

## Install for development

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.
5. Click the extension icon to open the options page.
6. Put Chrome into fullscreen and move the mouse to the configured screen edge.

## Settings

Click the extension action icon to open the options page. You can enable or disable the overlay, choose top, left, or right placement, and set the trigger area with fine presets from 0.5% to 5%, plus 10%, or a custom value from 0.5% to 30%.

Drawer size is adjusted directly on the drawer. Drag the visible edge to resize it; double-click that edge to restore the default size.

## Browser limits

Chrome extensions cannot draw over Chrome's own tab bar, toolbar, browser menus, or restricted pages such as `chrome://extensions`. This extension injects the tab strip into ordinary `http` and `https` web pages, so it works best for fullscreen browsing and fullscreen video pages.

The overlay is intended for Windows F11 immersive fullscreen. On macOS and other operating systems, the extension keeps the overlay disabled because native fullscreen/tab interactions already cover this use case better. The overlay also stays disabled while a web page element, such as a video player, is using the browser Fullscreen API.

## Chrome Web Store readiness

This project targets Manifest V3 and keeps the extension narrowly scoped to one purpose: showing the current window's tabs while Chrome is fullscreen. The extension does not load or execute remote code, does not include analytics, and stores only local/synced display preferences.

## Project layout

```text
manifest.json        Chrome extension manifest
src/background.js    Tab/window state and extension messaging
src/content.js       Injected tab strip behavior
src/content.css      Overlay styling
options/             Extension options page
images/              Store and toolbar icons
```

## Roadmap

- Add keyboard navigation inside the overlay.
- Add compact and roomy density modes.
- Add per-site opt out.
- Add importable icons and Chrome Web Store packaging.

## License

MIT
