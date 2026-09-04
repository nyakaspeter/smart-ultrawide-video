export const DEFAULT_ZOOM_TOLERANCE_PERCENT = 10;
export const MAX_ZOOM_TOLERANCE_PERCENT = 20;
export const DEFAULT_ZOOM_IN_DELAY_MS = 0;
export const DEFAULT_ZOOM_OUT_DELAY_MS = 0;
export const MAX_ZOOM_DELAY_MS = 2_000;
export const ZOOM_DELAY_STEP_MS = 100;
export const DEFAULT_ZOOM_ANIMATION_ENABLED = true;
export const DEFAULT_DEBUG_VIEW_ENABLED = false;
export const DEFAULT_BLACK_BAR_LUMA_THRESHOLD = 4;
export const MAX_BLACK_BAR_LUMA_THRESHOLD = 8;
export const DEFAULT_LOGO_TOLERANCE_PERCENT = 2.5;
export const MAX_LOGO_TOLERANCE_PERCENT = 5;
// A 21:9 picture letterboxed in a 16:9 video occupies 16/21 of its height.
export const DEFAULT_MAX_ZOOM_SCALE = 21 / 16;
export const MIN_MAX_ZOOM_SCALE = 1;
export const MAX_MAX_ZOOM_SCALE = 3;
export const SETTING_STORAGE_KEYS = [
  'enabled',
  'zoomTolerancePercent',
  'zoomInDelayMs',
  'zoomOutDelayMs',
  'zoomAnimationEnabled',
  'analysisIntervalMs',
  'analysisRate',
  'blackBarLumaThreshold',
  'logoTolerancePercent',
  'maxZoomPercent',
  'debugViewEnabled',
] as const;
export type SettingStorageKey = typeof SETTING_STORAGE_KEYS[number];
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
  zoomInDelayMs: number;
  zoomOutDelayMs: number;
  zoomAnimationEnabled: boolean;
  blackBarLumaThreshold: number;
  logoTolerancePercent: number;
  maxZoomScale: number;
  debugViewEnabled: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  zoomTolerancePercent: DEFAULT_ZOOM_TOLERANCE_PERCENT,
  analysisIntervalMs: DEFAULT_ANALYSIS_INTERVAL_MS,
  zoomInDelayMs: DEFAULT_ZOOM_IN_DELAY_MS,
  zoomOutDelayMs: DEFAULT_ZOOM_OUT_DELAY_MS,
  zoomAnimationEnabled: DEFAULT_ZOOM_ANIMATION_ENABLED,
  blackBarLumaThreshold: DEFAULT_BLACK_BAR_LUMA_THRESHOLD,
  logoTolerancePercent: DEFAULT_LOGO_TOLERANCE_PERCENT,
  maxZoomScale: DEFAULT_MAX_ZOOM_SCALE,
  debugViewEnabled: DEFAULT_DEBUG_VIEW_ENABLED,
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
  const normalizeDelay = (value: unknown, fallback: number): number => {
    const delay = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return Math.min(MAX_ZOOM_DELAY_MS, Math.max(0, Math.round(delay / ZOOM_DELAY_STEP_MS) * ZOOM_DELAY_STEP_MS));
  };
  const blackBarLumaThreshold = typeof values.blackBarLumaThreshold === 'number'
    && Number.isFinite(values.blackBarLumaThreshold)
    ? values.blackBarLumaThreshold
    : DEFAULT_BLACK_BAR_LUMA_THRESHOLD;
  const logoTolerancePercent = typeof values.logoTolerancePercent === 'number'
    && Number.isFinite(values.logoTolerancePercent)
    ? values.logoTolerancePercent
    : DEFAULT_LOGO_TOLERANCE_PERCENT;
  const maxZoomScale = typeof values.maxZoomPercent === 'number'
    && Number.isFinite(values.maxZoomPercent)
    ? values.maxZoomPercent / 100
    : typeof values.maxZoomScale === 'number' && Number.isFinite(values.maxZoomScale)
      ? values.maxZoomScale
      : DEFAULT_MAX_ZOOM_SCALE;

  return {
    enabled: values.enabled !== false,
    zoomTolerancePercent: Math.min(MAX_ZOOM_TOLERANCE_PERCENT, Math.max(0, tolerance)),
    analysisIntervalMs: nearestAnalysisInterval(Math.max(-1, analysisInterval)),
    zoomInDelayMs: normalizeDelay(values.zoomInDelayMs, DEFAULT_ZOOM_IN_DELAY_MS),
    zoomOutDelayMs: normalizeDelay(values.zoomOutDelayMs, DEFAULT_ZOOM_OUT_DELAY_MS),
    zoomAnimationEnabled: values.zoomAnimationEnabled !== false,
    blackBarLumaThreshold: Math.min(MAX_BLACK_BAR_LUMA_THRESHOLD, Math.max(0, Math.round(blackBarLumaThreshold))),
    logoTolerancePercent: Math.min(MAX_LOGO_TOLERANCE_PERCENT, Math.max(0, logoTolerancePercent)),
    maxZoomScale: Math.min(MAX_MAX_ZOOM_SCALE, Math.max(MIN_MAX_ZOOM_SCALE, maxZoomScale)),
    debugViewEnabled: values.debugViewEnabled === true,
  };
}
