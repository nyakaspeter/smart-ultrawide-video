import { browser } from 'wxt/browser';
import {
  ANALYSIS_INTERVAL_PRESETS,
  DEFAULT_SETTINGS,
  analysisIntervalLabel,
  normalizeSettings,
} from '../../core/settings';

const enabled = document.getElementById('enabled') as HTMLInputElement;
const tolerance = document.getElementById('zoom-tolerance') as HTMLInputElement;
const toleranceValue = document.getElementById('zoom-tolerance-value') as HTMLOutputElement;
const analysisFrequency = document.getElementById('analysis-frequency') as HTMLInputElement;
const analysisFrequencyValue = document.getElementById('analysis-frequency-value') as HTMLOutputElement;

const stored = await browser.storage.local.get([
  'enabled',
  'zoomTolerancePercent',
  'analysisIntervalMs',
  'analysisRate',
]);
const settings = normalizeSettings(stored);

enabled.checked = settings.enabled;
tolerance.value = String(settings.zoomTolerancePercent);
toleranceValue.value = `${settings.zoomTolerancePercent}%`;
const analysisIndex = ANALYSIS_INTERVAL_PRESETS.indexOf(
  settings.analysisIntervalMs as typeof ANALYSIS_INTERVAL_PRESETS[number],
);
analysisFrequency.value = String(Math.max(0, analysisIndex));
analysisFrequencyValue.value = analysisIntervalLabel(settings.analysisIntervalMs);

enabled.addEventListener('change', () => {
  void browser.storage.local.set({ enabled: enabled.checked });
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
