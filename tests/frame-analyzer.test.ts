// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { FrameAnalyzer } from '../src/analysis/frame-analyzer';

afterEach(() => vi.unstubAllGlobals());

it('samples at fixed 144p, preserves aspect ratio, and avoids upscaling', () => {
  const drawImage = vi.fn();
  vi.stubGlobal('OffscreenCanvas', class {
    getContext() {
      return {
        clearRect: vi.fn(), drawImage,
        getImageData: (_x: number, _y: number, width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4).fill(255),
        }),
      };
    }
  });
  const analyzer = new FrameAnalyzer();
  const video = document.createElement('video');
  Object.defineProperties(video, {
    readyState: { value: 2 },
    videoWidth: { value: 1920, configurable: true },
    videoHeight: { value: 1080, configurable: true },
  });
  expect(analyzer.analyze(video).kind).toBe('detected');
  expect(drawImage).toHaveBeenLastCalledWith(video, 0, 0, 256, 144);
  Object.defineProperties(video, { videoWidth: { value: 1080 }, videoHeight: { value: 1920 } });
  analyzer.analyze(video);
  expect(drawImage).toHaveBeenLastCalledWith(video, 0, 0, 144, 256);
  Object.defineProperties(video, { videoWidth: { value: 64 }, videoHeight: { value: 36 } });
  analyzer.analyze(video);
  expect(drawImage).toHaveBeenLastCalledWith(video, 0, 0, 64, 36);
});
