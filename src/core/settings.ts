export const DEFAULT_ZOOM_TOLERANCE_PERCENT = 10;
export const MAX_ZOOM_TOLERANCE_PERCENT = 20;
export const DEFAULT_ZOOM_OUT_DELAY_MS = 1_000;
export const MAX_ZOOM_OUT_DELAY_MS = 2_000;
export const ZOOM_OUT_DELAY_STEP_MS = 100;
export const DEFAULT_ZOOM_ANIMATION_ENABLED = true;
export const ANALYSIS_INTERVAL_PRESETS = [
  -1,
  5_000,
  2_000,
  1_000,
  500,
  200,
  100,
  1_000 / 15,
  1_000 / 30,
  1_000 / 60,
  0,
] as const;
export const DEFAULT_ANALYSIS_INTERVAL_MS = 200;

export interface ExtensionSettings {
  enabled: boolean;
  zoomTolerancePercent: number;
  analysisIntervalMs: number;
  zoomOutDelayMs: number;
  zoomAnimationEnabled: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  zoomTolerancePercent: DEFAULT_ZOOM_TOLERANCE_PERCENT,
  analysisIntervalMs: DEFAULT_ANALYSIS_INTERVAL_MS,
  zoomOutDelayMs: DEFAULT_ZOOM_OUT_DELAY_MS,
  zoomAnimationEnabled: DEFAULT_ZOOM_ANIMATION_ENABLED,
};

export function toggledEnabledState(storedEnabled: unknown): boolean {
  return storedEnabled === false;
}

function nearestAnalysisInterval(value: number): number {
  return ANALYSIS_INTERVAL_PRESETS.reduce((nearest, preset) =>
    Math.abs(preset - value) < Math.abs(nearest - value) ? preset : nearest,
  DEFAULT_ANALYSIS_INTERVAL_MS);
}

export function analysisIntervalLabel(intervalMs: number): string {
  if (intervalMs < 0) return 'Viewport changes';
  if (intervalMs === 0) return 'Every frame';
  if (intervalMs === 5_000) return '5s';
  if (intervalMs === 2_000) return '2s';
  if (intervalMs === 1_000) return '1s';
  return `${Math.round(1_000 / intervalMs)}/s`;
}

export function zoomOutDelayLabel(delayMs: number): string {
  return `${Number((delayMs / 1_000).toFixed(1))} s`;
}

export function normalizeSettings(values: Record<string, unknown>): ExtensionSettings {
  const tolerance = typeof values.zoomTolerancePercent === 'number'
    && Number.isFinite(values.zoomTolerancePercent)
    ? values.zoomTolerancePercent
    : DEFAULT_ZOOM_TOLERANCE_PERCENT;
  const storedInterval = typeof values.analysisIntervalMs === 'number'
    && Number.isFinite(values.analysisIntervalMs)
    ? values.analysisIntervalMs
    : null;
  const legacyRate = typeof values.analysisRate === 'number'
    && Number.isFinite(values.analysisRate)
    ? values.analysisRate
    : null;
  const analysisInterval = storedInterval
    ?? (legacyRate === null ? DEFAULT_ANALYSIS_INTERVAL_MS : legacyRate === 0 ? 0 : 1_000 / legacyRate);
  const storedZoomOutDelay = typeof values.zoomOutDelayMs === 'number'
    && Number.isFinite(values.zoomOutDelayMs)
    ? values.zoomOutDelayMs
    : DEFAULT_ZOOM_OUT_DELAY_MS;
  const zoomOutDelayMs = Math.min(
    MAX_ZOOM_OUT_DELAY_MS,
    Math.max(0, Math.round(storedZoomOutDelay / ZOOM_OUT_DELAY_STEP_MS) * ZOOM_OUT_DELAY_STEP_MS),
  );

  return {
    enabled: values.enabled !== false,
    zoomTolerancePercent: Math.min(MAX_ZOOM_TOLERANCE_PERCENT, Math.max(0, tolerance)),
    analysisIntervalMs: nearestAnalysisInterval(Math.max(-1, analysisInterval)),
    zoomOutDelayMs,
    zoomAnimationEnabled: values.zoomAnimationEnabled !== false,
  };
}
