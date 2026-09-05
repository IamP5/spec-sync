import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // The Vertex provider resolves project and location when a model is
    // created, so the modules under test need them even without credentials.
    env: {
      GOOGLE_VERTEX_PROJECT: 'test-project',
      GOOGLE_VERTEX_LOCATION: 'us-central1',
    },
  },
});
