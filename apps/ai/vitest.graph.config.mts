import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/mastra/graph/graph.integration.ts'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
