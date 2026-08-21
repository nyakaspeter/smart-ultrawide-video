import { browser } from 'wxt/browser';
import {
  ANALYSIS_INTERVAL_PRESETS,
  DEFAULT_SETTINGS,
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
const zoomOutDelay = document.getElementById('zoom-out-delay') as HTMLInputElement;
const zoomOutDelayValue = document.getElementById('zoom-out-delay-value') as HTMLOutputElement;
const analysisFrequency = document.getElementById('analysis-frequency') as HTMLInputElement;
const analysisFrequencyValue = document.getElementById('analysis-frequency-value') as HTMLOutputElement;

const stored = await browser.storage.local.get([
  'enabled',
  'zoomTolerancePercent',
  'zoomOutDelayMs',
  'zoomAnimationEnabled',
  'analysisIntervalMs',
  'analysisRate',
]);
const settings = normalizeSettings(stored);

enabled.checked = settings.enabled;
zoomAnimation.checked = settings.zoomAnimationEnabled;
tolerance.value = String(settings.zoomTolerancePercent);
toleranceValue.value = `${settings.zoomTolerancePercent}%`;
zoomOutDelay.value = String(settings.zoomOutDelayMs);
zoomOutDelayValue.value = zoomOutDelayLabel(settings.zoomOutDelayMs);
const analysisIndex = ANALYSIS_INTERVAL_PRESETS.indexOf(
  settings.analysisIntervalMs as typeof ANALYSIS_INTERVAL_PRESETS[number],
);
analysisFrequency.value = String(Math.max(0, analysisIndex));
analysisFrequencyValue.value = analysisIntervalLabel(settings.analysisIntervalMs);

function syncEnabledAppearance(): void {
  zoomSettings.disabled = !enabled.checked;
  brandIcon.src = enabled.checked
    ? '/icon/icon-48.png'
    : '/icon/icon-disabled-48.png';
}

syncEnabledAppearance();

enabled.addEventListener('change', () => {
  syncEnabledAppearance();
  void browser.storage.local.set({ enabled: enabled.checked });
});

zoomAnimation.addEventListener('change', () => {
  void browser.storage.local.set({ zoomAnimationEnabled: zoomAnimation.checked });
});

tolerance.addEventListener('input', () => {
  toleranceValue.value = `${tolerance.value}%`;
});
tolerance.addEventListener('change', () => {
  const zoomTolerancePercent = Number(tolerance.value);
  void browser.storage.local.set({
    zoomTolerancePercent: Number.isFinite(zoomTolerancePercent)
      ? zoomTolerancePercent
      : DEFAULT_SETTINGS.zoomTolerancePercent,
  });
});

zoomOutDelay.addEventListener('input', () => {
  zoomOutDelayValue.value = zoomOutDelayLabel(Number(zoomOutDelay.value));
});
zoomOutDelay.addEventListener('change', () => {
  const zoomOutDelayMs = Number(zoomOutDelay.value);
  void browser.storage.local.set({
    zoomOutDelayMs: Number.isFinite(zoomOutDelayMs)
      ? zoomOutDelayMs
      : DEFAULT_SETTINGS.zoomOutDelayMs,
  });
});

analysisFrequency.addEventListener('input', () => {
  const interval = ANALYSIS_INTERVAL_PRESETS[Number(analysisFrequency.value)]
    ?? DEFAULT_SETTINGS.analysisIntervalMs;
  analysisFrequencyValue.value = analysisIntervalLabel(interval);
});
analysisFrequency.addEventListener('change', () => {
  const analysisIntervalMs = ANALYSIS_INTERVAL_PRESETS[Number(analysisFrequency.value)]
    ?? DEFAULT_SETTINGS.analysisIntervalMs;
  void browser.storage.local.set({ analysisIntervalMs });
  void browser.storage.local.remove('analysisRate');
});
