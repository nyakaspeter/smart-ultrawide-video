import { describe, expect, it } from 'vitest';
import { calculateZoom } from '../src/geometry/zoom-calculator';

const fullContent = { left: 0, top: 0, right: 1, bottom: 1 };

describe('calculateZoom', () => {
  it('removes encoded bars without cropping cinematic content', () => {
    const result = calculateZoom({
      element: { left: 0, top: 0, width: 2100, height: 900 },
      viewport: { left: 0, top: 0, width: 2100, height: 900 },
      intrinsicWidth: 1920,
      intrinsicHeight: 1080,
      content: { left: 0, top: 0.125, right: 1, bottom: 0.875 },
      objectFit: 'contain',
      maxScale: Number.POSITIVE_INFINITY,
    });
    expect(result).not.toBeNull();
    expect(result!.scale).toBeCloseTo(21 / 16, 3);
    expect(result!.mode).toBe('contain');
  });

  it('does not crop genuine 16:9 content on a 21:9 display', () => {
    const result = calculateZoom({
      element: { left: 0, top: 0, width: 2100, height: 900 },
      viewport: { left: 0, top: 0, width: 2100, height: 900 },
      intrinsicWidth: 1920,
      intrinsicHeight: 1080,
      content: fullContent,
      objectFit: 'contain',
      maxScale: Number.POSITIVE_INFINITY,
    });
    expect(result!.scale).toBeCloseTo(1, 3);
    expect(result!.mode).toBe('contain');
  });

  it('fills a portrait display from portrait content encoded with side bars', () => {
    const result = calculateZoom({
      element: { left: 0, top: 0, width: 900, height: 1600 },
      viewport: { left: 0, top: 0, width: 900, height: 1600 },
      intrinsicWidth: 1920,
      intrinsicHeight: 1080,
      content: { left: 0.3418, top: 0, right: 0.6582, bottom: 1 },
      objectFit: 'contain',
      maxScale: Number.POSITIVE_INFINITY,
    });
    expect(result!.mode).toBe('contain');
  });

  it('contains landscape content on a portrait display', () => {
    const result = calculateZoom({
      element: { left: 0, top: 0, width: 900, height: 1600 },
      viewport: { left: 0, top: 0, width: 900, height: 1600 },
      intrinsicWidth: 1920,
      intrinsicHeight: 1080,
      content: fullContent,
      objectFit: 'contain',
      maxScale: Number.POSITIVE_INFINITY,
    });
    expect(result!.mode).toBe('contain');
    expect(result!.scale).toBeCloseTo(1, 3);
  });

  it('keeps all 21:9 picture visible on a 32:9 display', () => {
    const result = calculateZoom({
      element: { left: 800, top: 0, width: 1600, height: 900 },
      viewport: { left: 0, top: 0, width: 3200, height: 900 },
      intrinsicWidth: 1920,
      intrinsicHeight: 1080,
      content: { left: 0, top: 0.119, right: 1, bottom: 0.881 },
      objectFit: 'contain',
      maxScale: Number.POSITIVE_INFINITY,
    });
    expect(result!.mode).toBe('contain');
    expect(result!.scale).toBeCloseTo(900 / (900 * 0.762), 3);
  });

  it('ignores transient oversized player geometry that would shrink below 100%', () => {
    const result = calculateZoom({
      element: { left: -960, top: -540, width: 3840, height: 2160 },
      viewport: { left: 0, top: 0, width: 1920, height: 1080 },
      intrinsicWidth: 1920,
      intrinsicHeight: 1080,
      content: fullContent,
      objectFit: 'contain',
      maxScale: Number.POSITIVE_INFINITY,
    });

    expect(result).toBeNull();
  });

  it('applies the maximum zoom instead of skipping when the ideal zoom is higher', () => {
    const input = {
      element: { left: 800, top: 0, width: 1600, height: 900 },
      viewport: { left: 0, top: 0, width: 3200, height: 900 },
      intrinsicWidth: 1920,
      intrinsicHeight: 1080,
      content: { left: 0, top: 2 / 9, right: 1, bottom: 7 / 9 },
      objectFit: 'contain' as const,
    };
    expect(calculateZoom({ ...input, maxScale: Number.POSITIVE_INFINITY })!.scale).toBeCloseTo(1.8);

    const result = calculateZoom({
      ...input,
      maxScale: 1.5,
    });
    expect(result!.scale).toBe(1.5);
  });
});
