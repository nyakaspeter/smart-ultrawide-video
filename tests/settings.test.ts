import { describe, expect, it } from 'vitest';
import { normalizeSettings, toggledEnabledState } from '../src/core/settings';

describe('toggledEnabledState', () => {
  it('toggles the stored enabled state and treats a missing value as enabled', () => {
    expect(toggledEnabledState(true)).toBe(false);
    expect(toggledEnabledState(false)).toBe(true);
    expect(toggledEnabledState(undefined)).toBe(false);
  });
});

describe('normalizeSettings', () => {
  it('uses the simple popup defaults', () => {
    expect(normalizeSettings({})).toEqual({
      enabled: true,
      zoomTolerancePercent: 10,
      analysisIntervalMs: 200,
      zoomInDelayMs: 0,
      zoomOutDelayMs: 0,
      zoomAnimationEnabled: true,
      blackBarLumaThreshold: 4,
      logoTolerancePercent: 2.5,
      maxZoomScale: 21 / 16,
      debugViewEnabled: false,
    });
  });

  it('accepts valid values and clamps tolerance', () => {
    expect(normalizeSettings({
      enabled: false,
      zoomTolerancePercent: 99,
      analysisIntervalMs: 99_000,
      zoomInDelayMs: 2_099,
      zoomOutDelayMs: 2_099,
      zoomAnimationEnabled: false,
      blackBarLumaThreshold: 99,
      logoTolerancePercent: 99,
      maxZoomPercent: (21 / 16) * 100,
    })).toEqual({
      enabled: false,
      zoomTolerancePercent: 20,
      analysisIntervalMs: 5_000,
      zoomInDelayMs: 2_000,
      zoomOutDelayMs: 2_000,
      zoomAnimationEnabled: false,
      blackBarLumaThreshold: 8,
      logoTolerancePercent: 5,
      maxZoomScale: 21 / 16,
      debugViewEnabled: false,
    });
  });

  it('migrates the previous maximum-rate setting to the nearest interval preset', () => {
    expect(normalizeSettings({ analysisRate: 15 }).analysisIntervalMs).toBe(1_000 / 15);
    expect(normalizeSettings({ analysisRate: 0 }).analysisIntervalMs).toBe(0);
  });

  it('accepts the viewport-events-only preset', () => {
    expect(normalizeSettings({ analysisIntervalMs: -1 }).analysisIntervalMs).toBe(-1);
  });

  it('rounds zoom-out delay to 100 ms steps', () => {
    expect(normalizeSettings({ zoomOutDelayMs: 149 }).zoomOutDelayMs).toBe(100);
    expect(normalizeSettings({ zoomOutDelayMs: 151 }).zoomOutDelayMs).toBe(200);
  });

  it('formats zoom-out delay labels', async () => {
    const { zoomOutDelayLabel } = await import('../src/core/settings');
    expect([0, 900, 1_000, 1_500, 2_000].map(zoomOutDelayLabel)).toEqual([
      '0 s',
      '0.9 s',
      '1 s',
      '1.5 s',
      '2 s',
    ]);
  });

  it('uses concise user-facing labels for every frequency preset', async () => {
    const { ANALYSIS_INTERVAL_PRESETS, analysisIntervalLabel } = await import('../src/core/settings');
    expect(ANALYSIS_INTERVAL_PRESETS.map(analysisIntervalLabel)).toEqual([
      'Viewport changes',
      '5s',
      '2s',
      '1s',
      '2/s',
      '5/s',
      '10/s',
      '15/s',
      '30/s',
      '60/s',
      'Every frame',
    ]);
  });
});
