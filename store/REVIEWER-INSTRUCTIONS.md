# Chrome Web Store reviewer instructions

No account, payment, or special credentials are required.

## Basic test

1. Install and enable Smart Ultrawide Video.
2. Open an HTTP or HTTPS page containing a standard HTML5 video with black bars
   encoded inside the video frame.
3. Start playback and enter the player's fullscreen mode.
4. The extension detects the encoded bars and applies a uniform zoom of at least
   100% to reduce them.
5. Exit fullscreen. The original video style is restored immediately.

The toolbar popup can be used to change frame-analysis frequency,
zoom-change tolerance, zoom-out delay, and animation. Alt+Shift+U toggles the
extension globally.

## Important behavior

- The extension intentionally performs no frame analysis outside fullscreen.
- It does not zoom when a frame cannot be read, including when a player blocks
  canvas pixel access through DRM or cross-origin security restrictions.
- It never intentionally applies a scale below 100%.
- It makes no network requests and has no login flow.
