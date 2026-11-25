import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [preact()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/');
          if (norm.includes('/node_modules/')) {
            return 'vendor';
          }
          if (norm.includes('/src/i18n/locales/en.ts')) {
            return 'i18n-en';
          }
          if (norm.includes('/src/i18n/locales/ru.ts')) {
            return 'i18n-ru';
          }
          if (norm.includes('/src/i18n/locales/he.ts')) {
            return 'i18n-he';
          }
          if (norm.includes('/src/i18n/locales/')) {
            return 'i18n-locales';
          }
          if (norm.includes('/engine/') || norm.includes('/src/engine-api/')) {
            return 'engine-core';
          }
          if (norm.includes('/src/ui/kit/sheet/') || norm.endsWith('.sheet.tsx')) {
            return 'kit-sheet';
          }
          if (
            norm.includes('/src/ui/kit/') ||
            norm.includes('/src/domain/appearance.ts') ||
            norm.includes('/src/domain/shellState.ts') ||
            norm.includes('/src/i18n/')
          ) {
            return 'ui-kit';
          }
          if (norm.includes('/src/domain/lazyStores.ts')) {
            return 'domain-lazy';
          }
          if (
            norm.includes('/src/domain/review/myPlayAnalytics.ts') ||
            norm.includes('/src/domain/review/reviewHelpers.ts') ||
            norm.includes('/src/domain/strategy/postflopPlaybook.ts') ||
            norm.includes('/src/domain/equity/rangeBreakdown.ts')
          ) {
            return 'domain-core';
          }
          if (norm.includes('/src/domain/equity/')) {
            return 'store-equity';
          }
          if (norm.includes('/src/domain/hand/')) {
            return 'store-hand';
          }
          if (norm.includes('/src/domain/review/')) {
            return 'store-review';
          }
          if (norm.includes('/src/domain/strategy/')) {
            return 'store-strategy';
          }
          if (norm.includes('/src/domain/training/')) {
            return 'store-training';
          }
          if (norm.includes('/src/domain/nights/')) {
            return 'store-nights';
          }
          if (norm.includes('/src/domain/learn/')) {
            return 'store-learn';
          }
          if (norm.includes('/src/domain/home/')) {
            return 'store-home';
          }
          if (norm.includes('/src/domain/testHook.ts')) {
            return 'domain-testhook';
          }
          if (norm.includes('/src/domain/')) {
            return 'domain-core';
          }
          if (norm.includes('/src/ui/rooms/equity/')) {
            return 'room-equity';
          }
          if (norm.includes('/src/ui/rooms/hand/')) {
            return 'room-hand';
          }
          if (norm.includes('/src/ui/rooms/review/')) {
            return 'room-review';
          }
          if (norm.includes('/src/ui/rooms/strategy/')) {
            return 'room-strategy';
          }
          if (norm.includes('/src/ui/rooms/training/')) {
            return 'room-training';
          }
          if (norm.includes('/src/ui/rooms/nights/')) {
            return 'room-nights';
          }
          if (norm.includes('/src/ui/rooms/learn/')) {
            return 'room-learn';
          }
          if (norm.includes('/src/ui/rooms/home/')) {
            return 'room-home';
          }
          if (norm.includes('/src/ui/rooms/settings/') || norm.includes('/src/ui/rooms/SettingsRoom')) {
            return 'room-settings';
          }
          if (norm.includes('/src/ui/rooms/')) {
            return 'ui-rooms';
          }
          return undefined;
        },
      },
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'engine/**/*.test.ts'],
    css: true,
    poolOptions: {
      forks: {
        execArgv: ['--no-experimental-webstorage'],
      },
      threads: {
        execArgv: ['--no-experimental-webstorage'],
      },
    },
  },
});
