# Smart Ultrawide Video

A fullscreen-only Chrome extension that detects black bars baked into HTML5 video and applies the smallest uniform zoom needed to fill the display.

## Development

```sh
pnpm install
pnpm test
pnpm build
```

Load `.output/chrome-mv3` as an unpacked extension from `chrome://extensions`.

## Runtime principles

- Non-fullscreen playback is never visually modified.
- No video discovery, frame sampling, or aspect-ratio calculation runs outside fullscreen.
- Fullscreen analysis uses a 160-pixel sampling surface and an ordered frequency preset (5/s by default).
- Sampling stops while the tab is hidden and stops completely on fullscreen exit.
- Real picture is never cropped to force a mismatched aspect ratio; only detected encoded bars are removed.
- Frame-to-frame zoom changes within the configurable tolerance are ignored to prevent visual jitter (10% by default).
- Zoom-in changes apply immediately; zoom-out requires one continuous second of usable frames requesting it.
- An event-driven style guard restores the active transform if a player rewrites the video's inline CSS.
- During fullscreen entry, the video is concealed only for the synchronous first-frame measurement and revealed with the initial transform already applied.
- Window, visual-viewport, orientation, and fullscreen-element size changes trigger immediate geometry recalculation.
- Cross-origin or DRM-protected frames fail safely without speculative cropping.

## Toolbar and diagnostics

Pin the extension from Brave or Chrome's extensions menu, then click its toolbar icon to:

- turn the extension on or off globally;
- adjust the frame-to-frame zoom-change tolerance from 0% to 20%;
- choose viewport-change-only analysis or a frequency from every five seconds through every decoded frame.

The video tab's DevTools console receives one concise `[Smart Ultrawide]` line
only when the applied CSS zoom level actually changes, showing the old and new
zoom percentages.
