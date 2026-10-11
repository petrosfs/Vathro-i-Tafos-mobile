/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import pkg from './package.json';

// Το site σερβίρεται από https://<χρήστης>.github.io/Vathro-i-Tafos-mobile/
export default defineConfig({
  base: '/Vathro-i-Tafos-mobile/',
  // Μία πηγή για την έκδοση: το package.json. Το version.json επιτρέπει στο παιχνίδι να δει αν βγήκε νέα.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ v: pkg.version }) });
      },
    },
  ],
  build: { chunkSizeWarningLimit: 1500 },
  test: { include: ['src/**/*.test.ts'] },
});
