import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['apps/gateway/src/**/*.spec.ts'] },
});
