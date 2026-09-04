import { FrameAnalyzer } from '../analysis/frame-analyzer';
import { FullscreenController } from '../core/fullscreen-controller';
import { browser } from 'wxt/browser';
import { normalizeSettings, SETTING_STORAGE_KEYS } from '../core/settings';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  runAt: 'document_start',
  async main(ctx) {
    const analyzer = new FrameAnalyzer();
    const fullscreen = new FullscreenController(analyzer);

    const stored = await browser.storage.local.get([...SETTING_STORAGE_KEYS]);
    let settings = normalizeSettings(stored);
    let enabled = settings.enabled;
    let controllersStarted = false;

    fullscreen.setPreferences(settings);

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
      const changedValues: Record<string, unknown> = {};
      for (const key of SETTING_STORAGE_KEYS) {
        if (changes[key]) changedValues[key] = changes[key].newValue;
      }
      if (Object.keys(changedValues).length === 0) return;

      settings = normalizeSettings({ ...settings, ...changedValues });
      fullscreen.setPreferences(settings);
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
