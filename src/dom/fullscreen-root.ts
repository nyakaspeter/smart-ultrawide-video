type WebkitFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

export function findFullscreenRoot(): Element | null {
  const standard = document.fullscreenElement;
  if (standard) return standard;

  const webkit = (document as WebkitFullscreenDocument).webkitFullscreenElement;
  if (webkit) return webkit;

  // YouTube keeps this class synchronized with its real fullscreen state. It
  // also covers Chromium variants where the standard property is briefly null
  // while the browser moves the player into its fullscreen surface.
  return document.querySelector('.html5-video-player.ytp-fullscreen');
}
