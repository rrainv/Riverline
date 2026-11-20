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
          if (norm.includes('/src/domain/')) {
            return 'domain-stores';
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
