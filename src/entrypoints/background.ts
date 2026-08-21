import { browser } from 'wxt/browser';
import { toolbarIconPaths } from '../core/icon-state';
import { toggledEnabledState } from '../core/settings';

async function updateToolbarIcon(enabled?: boolean): Promise<void> {
  const isEnabled = enabled ?? (await browser.storage.local.get('enabled')).enabled !== false;
  await browser.action.setIcon({ path: toolbarIconPaths(isEnabled) });
}

async function toggleEnabled(): Promise<void> {
  const stored = await browser.storage.local.get('enabled');
  await browser.storage.local.set({
    enabled: toggledEnabledState(stored.enabled),
  });
}

export default defineBackground(() => {
  void updateToolbarIcon();

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.enabled) return;
    void updateToolbarIcon(changes.enabled.newValue !== false);
  });

  browser.commands.onCommand.addListener((command) => {
    if (command === 'toggle-enabled') void toggleEnabled();
  });
});
