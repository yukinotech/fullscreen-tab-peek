# Fullscreen Tab Peek

Fullscreen Tab Peek is a small Chrome extension that brings back a quick tab switcher while Chrome is in fullscreen. Move the mouse to the left or right screen edge and a compact, PotPlayer-style tab strip slides out over the page.

## Features

- Edge hover reveal while the current Chrome window is fullscreen.
- Left-side or right-side panel placement.
- Live list of tabs in the current window.
- Click a tab to activate it.
- Close tabs directly from the overlay.
- Lightweight Manifest V3 extension with no build step.
- No remote code, no analytics, and no network calls from the extension package.

## Install for development

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.
5. Put Chrome into fullscreen and move the mouse to the configured screen edge.

## Settings

Click the extension action icon to open the popup. You can enable or disable the overlay, choose the reveal side, and tune the edge trigger width.

## Browser limits

Chrome extensions cannot draw over Chrome's own tab bar, toolbar, browser menus, or restricted pages such as `chrome://extensions`. This extension injects the tab strip into ordinary `http` and `https` web pages, so it works best for fullscreen browsing and fullscreen video pages.

## Chrome Web Store readiness

This project targets Manifest V3 and keeps the extension narrowly scoped to one purpose: showing the current window's tabs while Chrome is fullscreen. The extension does not load or execute remote code, does not include analytics, and stores only local/synced display preferences.

## Project layout

```text
manifest.json        Chrome extension manifest
src/background.js    Tab/window state and extension messaging
src/content.js       Injected tab strip behavior
src/content.css      Overlay styling
popup/               Extension popup settings UI
images/              Store and toolbar icons
```

## Roadmap

- Add keyboard navigation inside the overlay.
- Add compact and roomy density modes.
- Add per-site opt out.
- Add importable icons and Chrome Web Store packaging.

## License

MIT
