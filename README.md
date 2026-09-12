# Smart Ultrawide Video

A fullscreen-only Chrome extension that detects black bars baked into HTML5 video and applies the smallest uniform zoom needed to fill the display.

All frame analysis happens locally. The extension has no analytics, accounts,
advertising, or network service.

## Development

```sh
pnpm install
pnpm test
pnpm build
```

Load `.output/chrome-mv3` as an unpacked extension from `chrome://extensions`.

Browser regression tests exercise CSS serialization and real video layout:

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

To use an existing Chromium browser, set `BROWSER_EXECUTABLE_PATH` to its executable.

## Release

```sh
pnpm typecheck
pnpm test
pnpm test:browser
pnpm zip
```

The Chrome Web Store upload package is written to `.output/`. Store listing
copy, reviewer guidance, and generated graphics are kept in `store/`.

See [PRIVACY.md](PRIVACY.md) for the published privacy policy.

## Runtime principles

- Non-fullscreen playback is never visually modified.
- No video discovery, frame sampling, or aspect-ratio calculation runs outside fullscreen.
- Fullscreen analysis uses a 160-pixel sampling surface and an ordered frequency preset (5/s by default).
- Sampling stops while the tab is hidden and stops completely on fullscreen exit.
- Real picture is never cropped to force a mismatched aspect ratio; only detected encoded bars are removed.
- Frame-to-frame zoom changes within the configurable tolerance are ignored to prevent visual jitter (10% by default).
- A detected bar is eligible for removal only when every sampled pixel in it is at or below the configurable luminance threshold.
- Automatic zoom is capped at a configurable maximum (131.25% by default, enough to vertically fill 21:9 content letterboxed in a 16:9 frame).
- Zoom-in and zoom-out confirmation delays are independently configurable (both default to 0 seconds).
- Established zoom changes use a configurable 150 ms animation, enabled by default.
- An event-driven style guard restores the active transform if a player rewrites the video's inline CSS.
- During fullscreen entry, the video is concealed only for the synchronous first-frame measurement and revealed with the initial transform already applied.
- Window, visual-viewport, orientation, and fullscreen-element size changes trigger immediate geometry recalculation.
- Cross-origin or DRM-protected frames fail safely without speculative cropping.

## Toolbar and diagnostics

Pin the extension from Brave or Chrome's extensions menu, then click its toolbar icon to:

- turn the extension on or off globally;
- turn zoom animation on or off;
- adjust the frame-to-frame zoom-change tolerance from 0% to 20%;
- adjust zoom-out delay from 0 to 2 seconds in 100 ms steps;
- adjust the luminance threshold from 0 to 8;
- adjust whole-frame logo tolerance from 0% to 5% (2.5% by default);
- adjust maximum zoom from 100% to 300%;
- enable a debug view that disables zoom and highlights the detected content rectangle;
- choose viewport-change-only analysis or a frequency from every five seconds through every decoded frame.

The video tab's DevTools console receives one concise `[Smart Ultrawide]` line
only when the applied CSS zoom level actually changes, showing the old and new
zoom percentages.
