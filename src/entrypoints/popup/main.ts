import { browser } from 'wxt/browser';
import {
  ANALYSIS_INTERVAL_PRESETS,
  DEFAULT_SETTINGS,
  SETTING_STORAGE_KEYS,
  type SettingStorageKey,
  analysisIntervalLabel,
  normalizeSettings,
  zoomOutDelayLabel,
} from '../../core/settings';

const enabled = document.getElementById('enabled') as HTMLInputElement;
const brandIcon = document.getElementById('brand-icon') as HTMLImageElement;
const zoomSettings = document.getElementById('zoom-settings') as HTMLFieldSetElement;
const zoomAnimation = document.getElementById('zoom-animation') as HTMLInputElement;
const tolerance = document.getElementById('zoom-tolerance') as HTMLInputElement;
const toleranceValue = document.getElementById('zoom-tolerance-value') as HTMLOutputElement;
const zoomInDelay = document.getElementById('zoom-in-delay') as HTMLInputElement;
const zoomInDelayValue = document.getElementById('zoom-in-delay-value') as HTMLOutputElement;
const zoomOutDelay = document.getElementById('zoom-out-delay') as HTMLInputElement;
const zoomOutDelayValue = document.getElementById('zoom-out-delay-value') as HTMLOutputElement;
const analysisFrequency = document.getElementById('analysis-frequency') as HTMLInputElement;
const analysisFrequencyValue = document.getElementById('analysis-frequency-value') as HTMLOutputElement;
const blackBarLuma = document.getElementById('black-bar-luma') as HTMLInputElement;
const blackBarLumaValue = document.getElementById('black-bar-luma-value') as HTMLOutputElement;
const logoTolerance = document.getElementById('logo-tolerance') as HTMLInputElement;
const logoToleranceValue = document.getElementById('logo-tolerance-value') as HTMLOutputElement;
const maxZoom = document.getElementById('max-zoom') as HTMLInputElement;
const maxZoomValue = document.getElementById('max-zoom-value') as HTMLOutputElement;
const debugView = document.getElementById('debug-view') as HTMLButtonElement;

const stored = await browser.storage.local.get([...SETTING_STORAGE_KEYS]);
const settings = normalizeSettings(stored);

enabled.checked = settings.enabled;
zoomAnimation.checked = settings.zoomAnimationEnabled;
let debugViewEnabled = settings.debugViewEnabled;
const analysisIndex = ANALYSIS_INTERVAL_PRESETS.indexOf(
  settings.analysisIntervalMs as typeof ANALYSIS_INTERVAL_PRESETS[number],
);
const defaultAnalysisIndex = ANALYSIS_INTERVAL_PRESETS.indexOf(DEFAULT_SETTINGS.analysisIntervalMs);

function syncEnabledAppearance(): void {
  zoomSettings.disabled = !enabled.checked;
  brandIcon.src = enabled.checked
    ? '/icon/icon-48.png'
    : '/icon/icon-disabled-48.png';
}

function syncDebugViewLabel(): void {
  debugView.textContent = debugViewEnabled ? 'Disable debug view' : 'Enable debug view';
}

function bindRange(
  input: HTMLInputElement,
  output: HTMLOutputElement,
  initialValue: number,
  defaultValue: number,
  storageKey: SettingStorageKey,
  format: (value: number) => string,
  toStoredValue: (value: number) => number = (value) => value,
  obsoleteStorageKey?: SettingStorageKey,
): void {
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'reset-button';
  reset.textContent = 'Reset';
  reset.setAttribute('aria-label', `Reset ${storageKey} to default`);
  input.closest('.control')?.querySelector('.control-heading')?.append(reset);

  const update = (): void => {
    const value = Number(input.value);
    output.value = format(value);
    reset.hidden = value === defaultValue;
  };
  input.value = String(initialValue);
  update();
  input.addEventListener('input', update);
  input.addEventListener('change', () => {
    void browser.storage.local.set({ [storageKey]: toStoredValue(Number(input.value)) });
    if (obsoleteStorageKey) void browser.storage.local.remove(obsoleteStorageKey);
  });
  reset.addEventListener('click', () => {
    input.value = String(defaultValue);
    update();
    void browser.storage.local.remove(storageKey);
    if (obsoleteStorageKey) void browser.storage.local.remove(obsoleteStorageKey);
  });
}

bindRange(tolerance, toleranceValue, settings.zoomTolerancePercent, DEFAULT_SETTINGS.zoomTolerancePercent, 'zoomTolerancePercent', (value) => `${value}%`);
bindRange(zoomInDelay, zoomInDelayValue, settings.zoomInDelayMs, DEFAULT_SETTINGS.zoomInDelayMs, 'zoomInDelayMs', zoomOutDelayLabel);
bindRange(zoomOutDelay, zoomOutDelayValue, settings.zoomOutDelayMs, DEFAULT_SETTINGS.zoomOutDelayMs, 'zoomOutDelayMs', zoomOutDelayLabel);
bindRange(blackBarLuma, blackBarLumaValue, settings.blackBarLumaThreshold, DEFAULT_SETTINGS.blackBarLumaThreshold, 'blackBarLumaThreshold', String);
bindRange(logoTolerance, logoToleranceValue, settings.logoTolerancePercent, DEFAULT_SETTINGS.logoTolerancePercent, 'logoTolerancePercent', (value) => `${value}%`);
bindRange(maxZoom, maxZoomValue, settings.maxZoomScale * 100, DEFAULT_SETTINGS.maxZoomScale * 100, 'maxZoomPercent', (value) => `${value}%`);
bindRange(
  analysisFrequency,
  analysisFrequencyValue,
  Math.max(0, analysisIndex),
  defaultAnalysisIndex,
  'analysisIntervalMs',
  (index) => analysisIntervalLabel(ANALYSIS_INTERVAL_PRESETS[index] ?? DEFAULT_SETTINGS.analysisIntervalMs),
  (index) => ANALYSIS_INTERVAL_PRESETS[index] ?? DEFAULT_SETTINGS.analysisIntervalMs,
  'analysisRate',
);

syncEnabledAppearance();
syncDebugViewLabel();

enabled.addEventListener('change', () => {
  syncEnabledAppearance();
  void browser.storage.local.set({ enabled: enabled.checked });
});

zoomAnimation.addEventListener('change', () => {
  void browser.storage.local.set({ zoomAnimationEnabled: zoomAnimation.checked });
});
debugView.addEventListener('click', () => {
  debugViewEnabled = !debugViewEnabled;
  syncDebugViewLabel();
  void browser.storage.local.set({ debugViewEnabled });
});
