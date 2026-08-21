// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FrameSampler } from '../src/analysis/frame-sampler';
import type { FrameAnalyzer } from '../src/analysis/frame-analyzer';

describe('FrameSampler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('does not keep analyzing while playback is paused', async () => {
    const analyze = vi.fn(() => ({
      kind: 'detected' as const,
      content: { left: 0, top: 0, right: 1, bottom: 1 },
      confidence: 0.9,
      isBlackFrame: false,
    }));
    const analyzer = { analyze } as unknown as FrameAnalyzer;
    const sampler = new FrameSampler(analyzer);
    const video = document.createElement('video');
    document.body.append(video);
    Object.defineProperty(video, 'paused', { value: true, configurable: true });

    sampler.start(video, () => undefined);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(analyze).not.toHaveBeenCalled();

    sampler.stop();
  });

  it('analyzes every decoded frame while playing', () => {
    const analyze = vi.fn(() => ({
      kind: 'detected' as const,
      content: { left: 0, top: 0, right: 1, bottom: 1 },
      confidence: 0.9,
      isBlackFrame: false,
    }));
    const analyzer = { analyze } as unknown as FrameAnalyzer;
    const sampler = new FrameSampler(analyzer);
    const video = document.createElement('video');
    document.body.append(video);
    const pendingFrames: VideoFrameRequestCallback[] = [];
    const cancelFrame = vi.fn();
    Object.defineProperties(video, {
      paused: { value: false, configurable: true },
      requestVideoFrameCallback: {
        value: (callback: VideoFrameRequestCallback) => {
          pendingFrames.push(callback);
          return 1;
        },
        configurable: true,
      },
      cancelVideoFrameCallback: { value: cancelFrame, configurable: true },
    });

    sampler.start(video, () => undefined);
    expect(analyze).not.toHaveBeenCalled();
    for (let frame = 1; frame <= 5; frame += 1) {
      const callback = pendingFrames.shift();
      expect(callback).toBeDefined();
      if (!callback) throw new Error('Expected a queued video frame callback');
      callback(performance.now(), {} as VideoFrameCallbackMetadata);
      expect(analyze).toHaveBeenCalledTimes(frame);
    }

    sampler.stop();
    expect(cancelFrame).toHaveBeenCalledOnce();
  });

  it('skips canvas analysis above the configured maximum rate', () => {
    const analyze = vi.fn(() => ({
      kind: 'detected' as const,
      content: { left: 0, top: 0, right: 1, bottom: 1 },
      confidence: 0.9,
      isBlackFrame: false,
    }));
    const analyzer = { analyze } as unknown as FrameAnalyzer;
    const sampler = new FrameSampler(analyzer);
    sampler.setAnalysisInterval(100);
    const video = document.createElement('video');
    document.body.append(video);
    const pendingFrames: VideoFrameRequestCallback[] = [];
    Object.defineProperties(video, {
      paused: { value: false, configurable: true },
      requestVideoFrameCallback: {
        value: (callback: VideoFrameRequestCallback) => {
          pendingFrames.push(callback);
          return 1;
        },
        configurable: true,
      },
      cancelVideoFrameCallback: { value: vi.fn(), configurable: true },
    });

    sampler.start(video, () => undefined);
    for (const timestamp of [0, 20, 50, 99, 100, 150, 200]) {
      const callback = pendingFrames.shift();
      expect(callback).toBeDefined();
      if (!callback) throw new Error('Expected a queued video frame callback');
      callback(timestamp, {} as VideoFrameCallbackMetadata);
    }

    expect(analyze).toHaveBeenCalledTimes(3);
    sampler.stop();
  });

  it('never analyzes more often than decoded video frames', () => {
    const analyze = vi.fn(() => ({
      kind: 'detected' as const,
      content: { left: 0, top: 0, right: 1, bottom: 1 },
      confidence: 0.9,
      isBlackFrame: false,
    }));
    const analyzer = { analyze } as unknown as FrameAnalyzer;
    const sampler = new FrameSampler(analyzer);
    sampler.setAnalysisInterval(1_000 / 60);
    const video = document.createElement('video');
    document.body.append(video);
    const pendingFrames: VideoFrameRequestCallback[] = [];
    Object.defineProperties(video, {
      paused: { value: false, configurable: true },
      requestVideoFrameCallback: {
        value: (callback: VideoFrameRequestCallback) => {
          pendingFrames.push(callback);
          return 1;
        },
        configurable: true,
      },
      cancelVideoFrameCallback: { value: vi.fn(), configurable: true },
    });

    sampler.start(video, () => undefined);
    const frameDuration = 1_000 / 24;
    for (let frame = 0; frame < 24; frame += 1) {
      const callback = pendingFrames.shift();
      expect(callback).toBeDefined();
      if (!callback) throw new Error('Expected a queued video frame callback');
      callback(frame * frameDuration, {} as VideoFrameCallbackMetadata);
    }

    expect(analyze).toHaveBeenCalledTimes(24);
    sampler.stop();
  });

  it('does not schedule decoded-frame analysis in viewport-events-only mode', () => {
    const analyze = vi.fn();
    const analyzer = { analyze } as unknown as FrameAnalyzer;
    const sampler = new FrameSampler(analyzer);
    sampler.setAnalysisInterval(-1);
    const video = document.createElement('video');
    document.body.append(video);
    const requestFrame = vi.fn();
    Object.defineProperties(video, {
      paused: { value: false, configurable: true },
      requestVideoFrameCallback: { value: requestFrame, configurable: true },
    });

    sampler.start(video, () => undefined);

    expect(requestFrame).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
    sampler.stop();
  });
});
