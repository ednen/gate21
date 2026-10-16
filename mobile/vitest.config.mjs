import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit tests cover the pure logic in src/lib and the map geometry (no React Native imports).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
