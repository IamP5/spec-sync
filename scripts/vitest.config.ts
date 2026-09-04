import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the Node-based hook/check scripts in this folder. They run
 * in a Node environment (no Angular/browser setup) and are kept separate from
 * the arch tests and the Angular unit tests. Run with `nx run scripts:test`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.spec.mjs'],
  },
});
