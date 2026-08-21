import { FrameAnalyzer } from '../analysis/frame-analyzer';
import { FullscreenController } from '../core/fullscreen-controller';
import { browser } from 'wxt/browser';
import { normalizeSettings } from '../core/settings';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  runAt: 'document_start',
  async main(ctx) {
    const analyzer = new FrameAnalyzer();
    const fullscreen = new FullscreenController(analyzer);

    const stored = await browser.storage.local.get([
      'enabled',
      'zoomTolerancePercent',
      'zoomOutDelayMs',
      'zoomAnimationEnabled',
      'analysisIntervalMs',
      'analysisRate',
    ]);
    let settings = normalizeSettings(stored);
    let enabled = settings.enabled;
    let controllersStarted = false;

    fullscreen.setPreferences(
      settings.zoomTolerancePercent,
      settings.analysisIntervalMs,
      settings.zoomOutDelayMs,
      settings.zoomAnimationEnabled,
    );

    const setControllersEnabled = (nextEnabled: boolean) => {
      enabled = nextEnabled;
      if (nextEnabled && !controllersStarted) {
        fullscreen.start();
        controllersStarted = true;
      } else if (!nextEnabled && controllersStarted) {
        fullscreen.stop();
        controllersStarted = false;
      }
    };

    setControllersEnabled(enabled);

    const onStorageChanged = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== 'local') return;
      const relevantChange = changes.enabled
        || changes.zoomTolerancePercent
        || changes.zoomOutDelayMs
        || changes.zoomAnimationEnabled
        || changes.analysisIntervalMs;
      if (!relevantChange) return;

      settings = normalizeSettings({
        ...settings,
        ...(changes.enabled ? { enabled: changes.enabled.newValue } : {}),
        ...(changes.zoomTolerancePercent
          ? { zoomTolerancePercent: changes.zoomTolerancePercent.newValue }
          : {}),
        ...(changes.zoomOutDelayMs
          ? { zoomOutDelayMs: changes.zoomOutDelayMs.newValue }
          : {}),
        ...(changes.zoomAnimationEnabled
          ? { zoomAnimationEnabled: changes.zoomAnimationEnabled.newValue }
          : {}),
        ...(changes.analysisIntervalMs
          ? { analysisIntervalMs: changes.analysisIntervalMs.newValue }
          : {}),
      });
      fullscreen.setPreferences(
        settings.zoomTolerancePercent,
        settings.analysisIntervalMs,
        settings.zoomOutDelayMs,
        settings.zoomAnimationEnabled,
      );
      setControllersEnabled(settings.enabled);
    };
    browser.storage.onChanged.addListener(onStorageChanged);

    ctx.onInvalidated(() => {
      browser.storage.onChanged.removeListener(onStorageChanged);
      if (controllersStarted) {
        fullscreen.stop();
      }
      analyzer.dispose();
    });
  },
});
