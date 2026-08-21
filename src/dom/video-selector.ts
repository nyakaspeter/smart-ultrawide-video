function visibleArea(rect: DOMRect, viewportWidth: number, viewportHeight: number): number {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(viewportWidth, rect.right);
  const bottom = Math.min(viewportHeight, rect.bottom);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function videosIn(root: ParentNode): HTMLVideoElement[] {
  const direct = Array.from(root.querySelectorAll('video'));
  if (root instanceof HTMLVideoElement) direct.unshift(root);
  if (direct.length > 0) return direct;

  const fromShadowRoots: HTMLVideoElement[] = [];
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot) fromShadowRoots.push(...videosIn(element.shadowRoot));
  }
  return fromShadowRoots;
}

export function selectDominantVideo(fullscreenElement: Element): HTMLVideoElement | null {
  const candidates = videosIn(fullscreenElement);
  let best: HTMLVideoElement | null = null;
  let bestScore = 0;

  for (const video of candidates) {
    const style = getComputedStyle(video);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.01) continue;
    const rect = video.getBoundingClientRect();
    const area = visibleArea(rect, window.innerWidth, window.innerHeight);
    if (area <= 0) continue;
    const playbackBoost = !video.paused && !video.ended ? 1.25 : 1;
    const readinessBoost = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? 1.1 : 1;
    const score = area * playbackBoost * readinessBoost;
    if (score > bestScore) {
      best = video;
      bestScore = score;
    }
  }

  return best;
}
