import { describe, expect, it } from 'vitest';

import { gemini, modelId } from './models';

describe('models', () => {
  it('defaults to a Gemini model on Vertex AI', () => {
    expect(modelId).toMatch(/^gemini-/);
    expect(gemini.provider).toContain('vertex');
    expect(gemini.modelId).toBe(modelId);
  });
});
