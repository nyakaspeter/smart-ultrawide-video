// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrameAnalyzer } from '../src/analysis/frame-analyzer';
import { FullscreenController } from '../src/core/fullscreen-controller';
import type { FrameAnalysis } from '../src/core/types';

describe('FullscreenController', () => {
  beforeEach(() => {
    Object.defineProperties(window, {
      innerWidth: { value: 2100, configurable: true },
      innerHeight: { value: 900, configurable: true },
    });
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
    document.body.replaceChildren();
  });

  it('clears the previous calculations when a reused video loads a new source', () => {
    const root = document.createElement('div');
    const video = document.createElement('video');
    root.append(video);
    document.body.append(root);
    video.style.objectFit = 'contain';
    video.style.opacity = '1';
    Object.defineProperties(video, {
      paused: { value: true, configurable: true },
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(0, 0, 2100, 900);
    Object.defineProperty(document, 'fullscreenElement', {
      value: root,
      configurable: true,
    });

    let analysis: FrameAnalysis = {
      kind: 'detected',
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      confidence: 0.9,
      isBlackFrame: false,
    };
    const analyze = vi.fn(() => analysis);
    const controller = new FullscreenController({ analyze } as unknown as FrameAnalyzer);
    controller.setPreferences(0, 200);
    controller.start();

    expect(video.style.getPropertyValue('transform')).toContain('scale(');

    analysis = { kind: 'unreadable', reason: 'not-ready' };
    video.dispatchEvent(new Event('loadstart'));

    expect(analyze).toHaveBeenCalledTimes(2);
    expect(video.style.getPropertyValue('transform')).toBe('');
    expect(video.style.getPropertyValue('visibility')).toBe('');
    controller.stop();
  });
});
