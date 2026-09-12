// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StyleController } from '../src/dom/style-controller';

beforeEach(() => {
  Object.defineProperties(window, {
    innerWidth: { value: 2100, configurable: true },
    innerHeight: { value: 900, configurable: true },
  });
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('StyleController', () => {
  it.each([false, true])('composes with player centering (encoded bars: %s)', (bars) => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.transform = 'translate(-50%, -50%)';
    video.style.transformOrigin = '800px 450px';
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    // Layout anchor is the viewport center; the player's transform centers a
    // 1600 x 900 video. The mock distinguishes native and untransformed geometry.
    video.getBoundingClientRect = () => video.style.transform === 'none'
      ? new DOMRect(1050, 450, 1600, 900)
      : new DOMRect(250, 0, 1600, 900);
    const styles = new StyleController();
    styles.apply(video, container, {
      kind: 'detected',
      content: { left: 0, top: bars ? 0.125 : 0, right: 1, bottom: bars ? 0.875 : 1 },
      isBlackFrame: false,
    });
    const value = video.style.transform;
    expect(value).toContain('translate(-50%, -50%)');
    expect(video.style.transformOrigin).toBe('800px 450px');
    const [, x, y, scale] = value.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px, 0\) scale\(([-\d.]+)\)/)!;
    // Apply the composed transform about the original origin to the picture's
    // center. Both axes must land at the viewport center with and without bars.
    expect(1050 + 800 + Number(x) + Number(scale) * -800).toBeCloseTo(1050);
    expect(450 + 450 + Number(y) + Number(scale) * -450).toBeCloseTo(450);
    expect(Number(scale)).toBeCloseTo(bars ? 1.3125 : 1);
    if (!bars) expect([Number(x), Number(y)]).toEqual([0, 0]);
    styles.restore();
    expect(video.style.transform).toBe('translate(-50%, -50%)');
  });

  it('updates centering when the player moves without resizing', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    let left = 250;
    video.getBoundingClientRect = () => new DOMRect(left, 0, 1600, 900);
    const styles = new StyleController();
    const analysis = {
      kind: 'detected' as const,
      content: { left: 0, top: 0, right: 1, bottom: 1 },
      isBlackFrame: false,
    };
    styles.apply(video, container, analysis);
    left = 350;
    expect(styles.apply(video, container, analysis)?.changed).toBe(true);
    expect(video.style.transform).toBe('translate3d(-100px, 0px, 0) scale(1)');
    styles.restore();
  });

  it('picks up stylesheet positioning changes and restores the cascade', () => {
    const sheet = document.createElement('style');
    sheet.textContent = '.embedded-video { transform: translateX(-100px); transform-origin: 50% 50%; }';
    const container = document.createElement('div');
    const video = document.createElement('video');
    video.className = 'embedded-video';
    container.append(video);
    document.body.append(sheet, container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);
    const styles = new StyleController();
    const analysis = {
      kind: 'detected' as const,
      content: { left: 0, top: 0, right: 1, bottom: 1 },
      isBlackFrame: false,
    };
    styles.apply(video, container, analysis);
    expect(video.style.transform).toContain(' translateX(-100px)');
    sheet.textContent = '.embedded-video { transform: translateX(-200px); transform-origin: 50% 50%; }';
    styles.apply(video, container, analysis);
    expect(video.style.transform).toContain(' translateX(-200px)');
    styles.restore();
    expect(video.style.transform).toBe('');
    expect(video.style.transformOrigin).toBe('');
    expect(getComputedStyle(video).transform).toBe('translateX(-200px)');
  });

  it('uses and restores the player’s updated transform', async () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);
    const styles = new StyleController();
    const analysis = {
      kind: 'detected' as const,
      content: { left: 0, top: 0, right: 1, bottom: 1 },
      isBlackFrame: false,
    };
    styles.apply(video, container, analysis);
    video.style.setProperty('transform', 'translateX(20px)', 'important');
    await new Promise((resolve) => setTimeout(resolve, 0));
    styles.apply(video, container, analysis);
    expect(video.style.transform).toContain(' translateX(20px)');
    styles.restore();
    expect(video.style.transform).toBe('translateX(20px)');
    expect(video.style.getPropertyPriority('transform')).toBe('important');
  });

  it('conceals fullscreen entry until the first transform is ready', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.visibility = 'visible';
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);

    const styles = new StyleController();
    styles.beginEntry(video, container);
    expect(video.style.getPropertyValue('visibility')).toBe('hidden');
    expect(video.style.getPropertyPriority('visibility')).toBe('important');

    styles.apply(video, container, {
      kind: 'detected',
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    });
    expect(video.style.getPropertyValue('visibility')).toBe('visible');
    expect(video.style.getPropertyValue('transform')).toContain('scale(');
  });

  it('reveals fullscreen entry when the first frame cannot be used', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.visibility = 'visible';

    const styles = new StyleController();
    styles.beginEntry(video, container);
    styles.revealEntry();

    expect(video.style.getPropertyValue('visibility')).toBe('visible');
    expect(video.style.getPropertyPriority('visibility')).toBe('');
  });

  it('restores every inline style and priority after fullscreen', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);

    video.style.setProperty('transform', 'rotate(1deg)', 'important');
    video.style.setProperty('transition', 'opacity 2s');
    video.style.objectFit = 'contain';
    container.style.setProperty('overflow', 'visible', 'important');

    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);
    container.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);

    const styles = new StyleController();
    expect(styles.apply(video, container, {
      kind: 'detected',
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    })).not.toBeNull();

    expect(video.style.getPropertyValue('transform')).toContain('scale(');
    expect(video.style.getPropertyPriority('transform')).toBe('important');
    expect(video.style.getPropertyValue('transition')).toBe('none');
    expect(container.style.getPropertyValue('overflow')).toBe('hidden');

    styles.restore();
    expect(video.style.getPropertyValue('transform')).toBe('rotate(1deg)');
    expect(video.style.getPropertyPriority('transform')).toBe('important');
    expect(video.style.getPropertyValue('transition')).toBe('opacity 2s');
    expect(video.style.getPropertyPriority('transition')).toBe('');
    expect(container.style.getPropertyValue('overflow')).toBe('visible');
    expect(container.style.getPropertyPriority('overflow')).toBe('important');
    expect(video.style.getPropertyValue('will-change')).toBe('');
  });

  it('keeps the previous transform for sub-percent zoom noise', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);
    container.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);

    const styles = new StyleController();
    const first = styles.apply(video, container, {
      kind: 'detected',
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    });
    const firstTransform = video.style.getPropertyValue('transform');
    const second = styles.apply(video, container, {
      kind: 'detected',
      content: { left: 0, top: 0.124, right: 1, bottom: 0.876 },
      isBlackFrame: false,
    });

    expect(first?.changed).toBe(true);
    expect(second?.changed).toBe(false);
    expect(video.style.getPropertyValue('transform')).toBe(firstTransform);
  });

  it('forces recalculation for viewport changes', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);
    container.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);
    const styles = new StyleController();
    const analysis = {
      kind: 'detected' as const,
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    };
    styles.apply(video, container, analysis);
    expect(styles.apply(video, container, analysis, true)?.changed).toBe(true);
    expect(video.style.getPropertyValue('transition')).toBe('none');
  });

  it('animates established video-frame zoom changes', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);

    const styles = new StyleController();
    styles.setZoomTolerancePercent(0);
    styles.apply(video, container, {
      kind: 'detected',
      content: { left: 0, top: 0.05, right: 1, bottom: 0.95 },
      isBlackFrame: false,
    });
    expect(video.style.getPropertyValue('transition')).toBe('none');

    styles.apply(video, container, {
      kind: 'detected',
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    });
    expect(video.style.getPropertyValue('transition')).toBe('transform 150ms ease-out');

    const establishedTransform = video.style.getPropertyValue('transform');
    let measurements = 0;
    video.getBoundingClientRect = () => {
      measurements++;
      return new DOMRect(0, 0, 2100, 900);
    };
    Object.defineProperty(video, 'getAnimations', {
      value: () => [{ transitionProperty: 'transform', playState: 'running' }],
    });
    styles.apply(video, container, {
      kind: 'detected',
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    });
    expect(video.style.getPropertyValue('transform')).toBe(establishedTransform);
    expect(measurements).toBe(0);
  });

  it('keeps established zoom changes instant when animation is disabled', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);

    const styles = new StyleController();
    styles.setZoomTolerancePercent(0);
    styles.setZoomAnimationEnabled(false);
    styles.apply(video, container, {
      kind: 'detected',
      content: { left: 0, top: 0.05, right: 1, bottom: 0.95 },
      isBlackFrame: false,
    });
    styles.apply(video, container, {
      kind: 'detected',
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    });

    expect(video.style.getPropertyValue('transition')).toBe('none');
  });

  it('keeps the last valid transform when transient geometry would require shrinking', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);

    const styles = new StyleController();
    const analysis = {
      kind: 'detected' as const,
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    };
    expect(styles.apply(video, container, analysis)).not.toBeNull();
    const validTransform = video.style.getPropertyValue('transform');

    video.getBoundingClientRect = () => new DOMRect(-1050, -450, 4200, 1800);
    expect(styles.apply(video, container, analysis, true)).toBeNull();
    expect(video.style.getPropertyValue('transform')).toBe(validTransform);
  });

  it('uses the configured zoom tolerance', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);

    const styles = new StyleController();
    const firstAnalysis = {
      kind: 'detected' as const,
      content: { left: 0, top: 0.05, right: 1, bottom: 0.95 },
      isBlackFrame: false,
    };
    const changedAnalysis = {
      ...firstAnalysis,
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
    };

    styles.setZoomTolerancePercent(20);
    expect(styles.apply(video, container, firstAnalysis)?.zoomChanged).toBe(true);
    expect(styles.apply(video, container, changedAnalysis)?.zoomChanged).toBe(false);

    styles.setZoomTolerancePercent(5);
    expect(styles.apply(video, container, changedAnalysis)?.zoomChanged).toBe(true);
  });

  it('applies zoom-out immediately when it exceeds tolerance', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);

    const styles = new StyleController();
    styles.setZoomTolerancePercent(0);
    styles.setZoomOutDelayMs(0);
    const firstAnalysis = {
      kind: 'detected' as const,
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    };
    const zoomOutAnalysis = {
      ...firstAnalysis,
      content: { left: 0, top: 0.1, right: 1, bottom: 0.9 },
    };

    expect(styles.apply(video, container, firstAnalysis)?.zoomChanged).toBe(true);
    expect(styles.apply(video, container, zoomOutAnalysis)?.zoomChanged).toBe(true);
  });

  it('waits for the configured zoom-out delay', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);

    let now = 0;
    const styles = new StyleController(() => now);
    styles.setZoomTolerancePercent(0);
    styles.setZoomOutDelayMs(1_000);
    const zoomedIn = {
      kind: 'detected' as const,
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    };
    const zoomedOut = {
      ...zoomedIn,
      content: { left: 0, top: 0.1, right: 1, bottom: 0.9 },
    };

    expect(styles.apply(video, container, zoomedIn)?.zoomChanged).toBe(true);
    expect(styles.apply(video, container, zoomedOut)?.zoomChanged).toBe(false);
    now = 999;
    expect(styles.apply(video, container, zoomedOut)?.zoomChanged).toBe(false);
    now = 1_000;
    expect(styles.apply(video, container, zoomedOut)?.zoomChanged).toBe(true);
  });

  it('waits for the configured zoom-in delay', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);

    let now = 0;
    const styles = new StyleController(() => now);
    styles.setZoomTolerancePercent(0);
    styles.setZoomInDelayMs(1_000);
    const zoomedIn = {
      kind: 'detected' as const,
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    };

    expect(styles.apply(video, container, zoomedIn)?.zoomChanged).toBe(false);
    now = 999;
    expect(styles.apply(video, container, zoomedIn)?.zoomChanged).toBe(false);
    now = 1_000;
    expect(styles.apply(video, container, zoomedIn)?.zoomChanged).toBe(true);
  });

  it('restores the active transform when the page overwrites it', async () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);

    const styles = new StyleController();
    styles.apply(video, container, {
      kind: 'detected',
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    });
    const expectedTransform = video.style.getPropertyValue('transform');

    video.style.setProperty('transform', 'scale(1)');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(video.style.getPropertyValue('transform')).toBe(expectedTransform);
    expect(video.style.getPropertyPriority('transform')).toBe('important');
    styles.restore();
  });

  it('shows the detected content rectangle without zooming in debug view', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    document.body.append(container);
    video.style.objectFit = 'contain';
    Object.defineProperties(video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);

    const styles = new StyleController();
    styles.setDebugView(true);
    styles.apply(video, container, {
      kind: 'detected',
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    });

    const overlay = document.querySelector<HTMLElement>('[data-smart-ultrawide-debug="content"]');
    expect(video.style.getPropertyValue('transform')).toBe('');
    expect(overlay?.style.left).toBe('250px');
    expect(overlay?.style.top).toBe('112.5px');
    expect(overlay?.style.width).toBe('1600px');
    expect(overlay?.style.height).toBe('675px');

    styles.setDebugView(false);
    expect(overlay?.isConnected).toBe(false);
    styles.restore();
  });
});
