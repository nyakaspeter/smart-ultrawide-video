import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../src/core/settings';

describe('normalizeSettings', () => {
  it('uses the simple popup defaults', () => {
    expect(normalizeSettings({})).toEqual({
      enabled: true,
      zoomTolerancePercent: 10,
      analysisIntervalMs: 200,
    });
  });

  it('accepts valid values and clamps tolerance', () => {
    expect(normalizeSettings({
      enabled: false,
      zoomTolerancePercent: 99,
      analysisIntervalMs: 99_000,
    })).toEqual({
      enabled: false,
      zoomTolerancePercent: 20,
      analysisIntervalMs: 5_000,
    });
  });

  it('migrates the previous maximum-rate setting to the nearest interval preset', () => {
    expect(normalizeSettings({ analysisRate: 15 }).analysisIntervalMs).toBe(1_000 / 15);
    expect(normalizeSettings({ analysisRate: 0 }).analysisIntervalMs).toBe(0);
  });

  it('accepts the viewport-events-only preset', () => {
    expect(normalizeSettings({ analysisIntervalMs: -1 }).analysisIntervalMs).toBe(-1);
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
