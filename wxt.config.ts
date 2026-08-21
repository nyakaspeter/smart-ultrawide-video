import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Smart Ultrawide Video',
    description: 'Detects and removes video black bars only in fullscreen.',
    version: '0.6.1',
    minimum_chrome_version: '110',
    permissions: ['storage'],
  },
  vite: () => ({
    build: {
      target: 'chrome110',
    },
  }),
});
