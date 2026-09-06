import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/mastra/graph/graph.smoke.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
