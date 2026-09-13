// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrameAnalyzer } from '../src/analysis/frame-analyzer';
import { FullscreenController } from '../src/core/fullscreen-controller';
import type { FrameAnalysis } from '../src/core/types';
import { DEFAULT_SETTINGS } from '../src/core/settings';

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
      isBlackFrame: false,
    };
    const analyze = vi.fn(() => analysis);
    const setBlackBarLumaThreshold = vi.fn();
    const setLogoTolerancePercent = vi.fn();
    const controller = new FullscreenController({ analyze, setBlackBarLumaThreshold, setLogoTolerancePercent } as unknown as FrameAnalyzer);
    controller.setPreferences({ ...DEFAULT_SETTINGS, zoomTolerancePercent: 0 });
    controller.start();

    expect(video.style.getPropertyValue('transform')).toContain('scale(');

    analysis = { kind: 'unreadable', reason: 'not-ready' };
    video.dispatchEvent(new Event('loadstart'));

    expect(analyze).toHaveBeenCalledTimes(2);
    expect(video.style.getPropertyValue('transform')).toBe('');
    expect(video.style.getPropertyValue('visibility')).toBe('');
    controller.stop();
  });

  it('keeps the debug rectangle unchanged when the next frame is black', () => {
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
    Object.defineProperty(document, 'fullscreenElement', { value: root, configurable: true });

    const analyze = vi.fn((): FrameAnalysis => ({
      kind: 'detected',
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    }));
    const controller = new FullscreenController({
      analyze,
      setBlackBarLumaThreshold: vi.fn(),
      setLogoTolerancePercent: vi.fn(),
    } as unknown as FrameAnalyzer);
    controller.setPreferences({ ...DEFAULT_SETTINGS, debugViewEnabled: true });
    controller.start();

    const overlay = document.querySelector<HTMLElement>('[data-smart-ultrawide-debug="content"]')!;
    const rectangle = [overlay.style.left, overlay.style.top, overlay.style.width, overlay.style.height];
    const onFrame = (controller as unknown as { onFrame: (frame: FrameAnalysis) => void }).onFrame;
    onFrame({
      kind: 'detected',
      content: { left: 0, top: 0, right: 1, bottom: 1 },
      isBlackFrame: true,
      signalPixelPercent: 0.44,
    });

    expect([overlay.style.left, overlay.style.top, overlay.style.width, overlay.style.height]).toEqual(rectangle);
    expect(document.querySelector('[data-smart-ultrawide-debug="status"]')?.textContent)
      .toBe('Black frame • 0.44% above threshold • rectangle held');
    controller.stop();
  });

  it('analyzes an inline video in debug view without applying zoom', () => {
    const video = document.createElement('video');
    document.body.append(video);
    video.style.objectFit = 'contain';
    video.style.opacity = '1';
    Object.defineProperties(video, {
      paused: { value: true, configurable: true },
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    });
    video.getBoundingClientRect = () => new DOMRect(250, 0, 1600, 900);

    const analyze = vi.fn((): FrameAnalysis => ({
      kind: 'detected',
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      isBlackFrame: false,
    }));
    const controller = new FullscreenController({
      analyze,
      setBlackBarLumaThreshold: vi.fn(),
      setLogoTolerancePercent: vi.fn(),
    } as unknown as FrameAnalyzer);
    controller.setPreferences({ ...DEFAULT_SETTINGS, debugViewEnabled: true });
    controller.start();

    expect(analyze).toHaveBeenCalled();
    expect(video.style.transform).toBe('');
    expect(document.querySelector('[data-smart-ultrawide-debug="content"]')).not.toBeNull();
    controller.stop();
  });

  it('does not inspect inline videos outside debug view', () => {
    const video = document.createElement('video');
    document.body.append(video);
    video.style.opacity = '1';
    video.getBoundingClientRect = () => new DOMRect(0, 0, 1600, 900);
    const analyze = vi.fn();
    const controller = new FullscreenController({
      analyze,
      setBlackBarLumaThreshold: vi.fn(),
      setLogoTolerancePercent: vi.fn(),
    } as unknown as FrameAnalyzer);
    controller.setPreferences(DEFAULT_SETTINGS);
    controller.start();

    expect(analyze).not.toHaveBeenCalled();
    expect(video.style.cssText).toBe('opacity: 1;');
    controller.stop();
  });
});
