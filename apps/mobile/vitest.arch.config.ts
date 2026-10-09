import { defineConfig } from 'vitest/config';

/**
 * The architecture tests run with tsarch and the TypeScript compiler API,
 * which need a Node environment; they cannot run in the jest-expo unit-test
 * setup (`nx run mobile:test`). Run them with `nx run mobile:test-arch`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['arch/**/*.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
