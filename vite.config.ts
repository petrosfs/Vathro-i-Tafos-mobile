/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Το site σερβίρεται από https://<χρήστης>.github.io/Vathro-i-Tafos-mobile/
export default defineConfig({
  base: '/Vathro-i-Tafos-mobile/',
  build: { chunkSizeWarningLimit: 1500 },
  test: { include: ['src/**/*.test.ts'] },
});
