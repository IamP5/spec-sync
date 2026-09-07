import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import {
  CHAT_EFFORT_KEY,
  CHAT_MODEL_KEY,
  chatModelFor,
  chatModels,
  chatProviderOptions,
  chatProviderOptionsFor,
  gemini,
  modelId,
  resolveChatModel,
} from './models';

const base = {
  GOOGLE_VERTEX_PROJECT: 'test-project',
  GOOGLE_VERTEX_LOCATION: 'us-central1',
};

describe('models', () => {
  it('defaults to a Gemini model on Vertex AI', () => {
    expect(modelId).toMatch(/^gemini-/);
    expect(gemini.provider).toContain('vertex');
    expect(gemini.modelId).toBe(modelId);
  });

  it('offers the Gemini models and the default, without OpenAI until its key is set', () => {
    expect(chatModels({ ...base, VERTEX_MODEL: 'gemini-3.5-flash' })).toEqual([
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', provider: 'vertex' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'vertex' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'vertex' },
    ]);
    expect(
      chatModels({
        ...base,
        VERTEX_MODELS: ' gemini-2.5-flash , gemini-3.5-flash-lite ',
        OPENAI_API_KEY: 'sk-test',
      }),
    ).toEqual([
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'vertex' },
      {
        id: 'gemini-3.5-flash-lite',
        label: 'Gemini 3.5 Flash Lite',
        provider: 'vertex',
      },
      { id: 'gpt-5.6-luna', label: 'GPT 5.6 Luna', provider: 'openai' },
    ]);
  });

  it('resolves Gemini ids on Vertex and OpenAI ids through the model router', () => {
    const env = { ...base, OPENAI_API_KEY: 'sk-test' };
    const flash = resolveChatModel('gemini-2.5-pro', env);
    expect(typeof flash).toBe('object');
    expect((flash as { modelId: string }).modelId).toBe('gemini-2.5-pro');
    expect((flash as { provider: string }).provider).toContain('vertex');
    expect(resolveChatModel('gpt-5.6-luna', env)).toBe('openai/gpt-5.6-luna');
  });

  it('falls back to the default model for unknown ids and unavailable providers', () => {
    expect(resolveChatModel(undefined, base)).toBe(gemini);
    expect(resolveChatModel('gemini-99', base)).toBe(gemini);
    // Without OPENAI_API_KEY the OpenAI model is not offered, so it is not run either.
    expect(resolveChatModel('gpt-5.6-luna', base)).toBe(gemini);
    expect(resolveChatModel(42, base)).toBe(gemini);
  });

  it('maps the effort to the thinking settings of the provider serving the model', () => {
    const env = { ...base, OPENAI_API_KEY: 'sk-test' };
    // No effort: Gemini keeps streaming thought summaries, OpenAI runs untouched.
    expect(chatProviderOptions('gemini-2.5-flash', undefined, env)).toEqual({
      google: { thinkingConfig: { includeThoughts: true } },
    });
    expect(chatProviderOptions('gemini-2.5-flash', 'auto', env)).toEqual({
      google: { thinkingConfig: { includeThoughts: true } },
    });
    expect(chatProviderOptions('gpt-5.6-luna', undefined, env)).toEqual({});
    // Gemini 2.5 has a token budget, Gemini 3.x a thinking level.
    expect(chatProviderOptions('gemini-2.5-pro', 'high', env)).toEqual({
      google: {
        thinkingConfig: { includeThoughts: true, thinkingBudget: 24576 },
      },
    });
    expect(
      chatProviderOptions('gemini-3.5-flash', 'low', {
        ...env,
        VERTEX_MODELS: 'gemini-3.5-flash',
      }),
    ).toEqual({
      google: {
        thinkingConfig: { includeThoughts: true, thinkingLevel: 'low' },
      },
    });
    expect(chatProviderOptions('gpt-5.6-luna', 'medium', env)).toEqual({
      openai: { reasoningEffort: 'medium' },
    });
    // Unknown efforts and models fall back to the defaults.
    expect(chatProviderOptions('gpt-5.6-luna', 'max', env)).toEqual({});
    expect(chatProviderOptions('gemini-99', 'high', env)).toEqual({
      google: {
        thinkingConfig: { includeThoughts: true, thinkingBudget: 24576 },
      },
    });
  });

  it('reads the chosen effort from the request context', () => {
    const requestContext = new RequestContext();
    requestContext.set(CHAT_MODEL_KEY, 'gemini-2.5-pro');
    requestContext.set(CHAT_EFFORT_KEY, 'low');
    expect(chatProviderOptionsFor(requestContext)).toEqual({
      google: {
        thinkingConfig: { includeThoughts: true, thinkingBudget: 1024 },
      },
    });
  });

  it('reads the chosen model from the request context', () => {
    const requestContext = new RequestContext();
    expect(chatModelFor(requestContext)).toBe(gemini);
    requestContext.set(CHAT_MODEL_KEY, 'gemini-2.5-pro');
    expect((chatModelFor(requestContext) as { modelId: string }).modelId).toBe(
      'gemini-2.5-pro',
    );
  });
});
