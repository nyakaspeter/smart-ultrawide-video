import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Smart Ultrawide Video',
    description: 'Auto-detects and removes black bars from fullscreen videos',
    version: '1.1.2',
    minimum_chrome_version: '110',
    permissions: ['storage'],
    icons: {
      16: 'icon/icon-16.png',
      32: 'icon/icon-32.png',
      48: 'icon/icon-48.png',
      128: 'icon/icon-store-128.png',
    },
    action: {
      default_icon: {
        16: 'icon/icon-16.png',
        32: 'icon/icon-32.png',
        48: 'icon/icon-48.png',
        128: 'icon/icon-128.png',
      },
    },
    commands: {
      'toggle-enabled': {
        suggested_key: {
          default: 'Alt+Shift+U',
        },
        description: 'Enable or disable Smart Ultrawide Video',
      },
    },
  },
  vite: () => ({
    build: {
      target: 'chrome110',
    },
  }),
});
