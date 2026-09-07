import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it } from 'vitest';

import { resetTariffCache } from './credits/credits-client';
import {
  AUTO_LONG_PROMPT_CHARS,
  AUTO_SHORT_PROMPT_CHARS,
  CHAT_EFFORT_KEY,
  CHAT_MODE_KEY,
  CHAT_RESOLVED_MODE_KEY,
  CHAT_ROLE_MODELS_KEY,
  chatEfforts,
  chatModelIds,
  chatModelOfMode,
  chatModels,
  chatModes,
  chatProviderOptions,
  chatProviderOptionsFor,
  chatRoles,
  comparesManyVehicles,
  DEFAULT_DISCOVERY_MODEL,
  labelOf,
  modelForRole,
  modeOf,
  modesOfModel,
  resolveAutoMode,
  resolvedModelForRole,
  roleOverrideOf,
} from './models';

const base = {
  GOOGLE_VERTEX_PROJECT: 'test-project',
  GOOGLE_VERTEX_LOCATION: 'us-central1',
};

function contextWith(entries: Record<string, unknown>): RequestContext {
  const requestContext = new RequestContext();
  for (const [key, value] of Object.entries(entries)) {
    requestContext.set(key, value);
  }
  return requestContext;
}

afterEach(() => {
  resetTariffCache();
});

describe('role registry', () => {
  it('routes every role but discovery through OpenRouter', () => {
    for (const role of [
      'chat',
      'vision',
      'identification',
      'contentDiscovery',
      'extraction',
      'title',
      'router',
    ] as const) {
      const resolved = resolvedModelForRole(role, undefined, base);
      expect(resolved.provider).toBe('openrouter');
      expect(modelForRole(role, undefined, base)).toBe(
        `openrouter/${resolved.id}`,
      );
    }
  });

  it('keeps discovery on the Vertex provider instance so grounding still works', () => {
    expect(resolvedModelForRole('discovery', undefined, base)).toEqual({
      provider: 'vertex',
      id: DEFAULT_DISCOVERY_MODEL,
    });
    const model = modelForRole('discovery', undefined, base);
    expect(typeof model).toBe('object');
    expect((model as { provider: string }).provider).toContain('vertex');
    expect((model as { modelId: string }).modelId).toBe(
      DEFAULT_DISCOVERY_MODEL,
    );
  });

  it('resolves a role to its default without a request context', () => {
    // The curator workflow and the thread titles run outside a chat request;
    // they must never follow a user's mode.
    expect(resolvedModelForRole('chat', undefined, base).id).toBe(
      'google/gemini-3.8-flash',
    );
    expect(resolvedModelForRole('extraction', undefined, base).id).toBe(
      'google/gemini-3.8-flash',
    );
    expect(resolvedModelForRole('title', undefined, base).id).toBe(
      'openai/gpt-5.6-luna',
    );
    expect(
      resolvedModelForRole('extraction', undefined, {
        ...base,
        SPECSYNC_EXTRACTION_MODEL: 'google/gemini-2.5-flash',
      }).id,
    ).toBe('google/gemini-2.5-flash');
    expect(
      resolvedModelForRole('title', undefined, {
        ...base,
        SPECSYNC_TITLE_MODEL: 'google/gemini-2.5-flash-lite',
      }).id,
    ).toBe('google/gemini-2.5-flash-lite');
  });

  it('maps each mode to its models, with content discovery following chat', () => {
    const rolesOf = (mode: string) => {
      const requestContext = contextWith({ [CHAT_RESOLVED_MODE_KEY]: mode });
      return Object.fromEntries(
        (['chat', 'vision', 'identification', 'contentDiscovery'] as const).map(
          (role) => [role, resolvedModelForRole(role, requestContext, base).id],
        ),
      );
    };
    expect(rolesOf('velocity')).toEqual({
      chat: 'google/gemini-3.5-flash-lite',
      vision: 'google/gemini-3.5-flash-lite',
      identification: 'google/gemini-3.5-flash-lite',
      contentDiscovery: 'google/gemini-3.5-flash-lite',
    });
    expect(rolesOf('normal')).toEqual({
      chat: 'google/gemini-3.8-flash',
      vision: 'google/gemini-3.8-flash',
      identification: 'google/gemini-3.8-flash',
      contentDiscovery: 'google/gemini-3.8-flash',
    });
    expect(rolesOf('intelligent')).toEqual({
      chat: 'anthropic/claude-sonnet-5',
      vision: 'google/gemini-3.1-pro-preview',
      identification: 'google/gemini-3.8-flash',
      contentDiscovery: 'anthropic/claude-sonnet-5',
    });
  });

  it('keeps extraction and title outside the mode table', () => {
    const requestContext = contextWith({
      [CHAT_RESOLVED_MODE_KEY]: 'intelligent',
    });
    expect(resolvedModelForRole('extraction', requestContext, base).id).toBe(
      'google/gemini-3.8-flash',
    );
    expect(resolvedModelForRole('title', requestContext, base).id).toBe(
      'openai/gpt-5.6-luna',
    );
  });

  it('prefers the pinned mode over the one the browser asked for', () => {
    // Auto is resolved before admission; every later role reads the decision.
    expect(
      modeOf(
        contextWith({
          [CHAT_MODE_KEY]: 'auto',
          [CHAT_RESOLVED_MODE_KEY]: 'velocity',
        }),
      ),
    ).toBe('velocity');
    expect(modeOf(contextWith({ [CHAT_MODE_KEY]: 'intelligent' }))).toBe(
      'intelligent',
    );
    expect(modeOf(contextWith({ [CHAT_MODE_KEY]: 'nonsense' }))).toBe('normal');
    expect(modeOf(undefined)).toBe('normal');
  });
});

describe('advanced role overrides', () => {
  const env = { ...base };

  it('honours an override of a configurable role', () => {
    const requestContext = contextWith({
      [CHAT_ROLE_MODELS_KEY]: { chat: 'google/gemini-3.5-flash-lite' },
    });
    expect(roleOverrideOf('chat', requestContext, env)).toBe(
      'google/gemini-3.5-flash-lite',
    );
    expect(resolvedModelForRole('chat', requestContext, env).id).toBe(
      'google/gemini-3.5-flash-lite',
    );
  });

  it('ignores overrides of roles the user does not configure', () => {
    const requestContext = contextWith({
      [CHAT_ROLE_MODELS_KEY]: {
        extraction: 'anthropic/claude-sonnet-5',
        title: 'anthropic/claude-sonnet-5',
        discovery: 'anthropic/claude-sonnet-5',
      },
    });
    expect(roleOverrideOf('extraction', requestContext, env)).toBeUndefined();
    expect(resolvedModelForRole('title', requestContext, env).id).toBe(
      'openai/gpt-5.6-luna',
    );
    expect(resolvedModelForRole('discovery', requestContext, env).id).toBe(
      DEFAULT_DISCOVERY_MODEL,
    );
  });

  it('ignores an override outside the catalog rather than failing the run', () => {
    const requestContext = contextWith({
      [CHAT_ROLE_MODELS_KEY]: { chat: 'meta-llama/llama-4' },
    });
    expect(roleOverrideOf('chat', requestContext, env)).toBeUndefined();
    expect(resolvedModelForRole('chat', requestContext, env).id).toBe(
      'google/gemini-3.8-flash',
    );
  });

  it('offers only capable models per role', () => {
    const roles = chatRoles([
      'google/gemini-3.8-flash',
      'anthropic/claude-sonnet-5',
    ]);
    expect(roles.map((role) => role.id)).toEqual([
      'chat',
      'vision',
      'identification',
      'contentDiscovery',
    ]);
    // Both models read attachments and produce structured output, so the
    // capability filter keeps them; a model Mastra reports as incapable is
    // dropped instead.
    for (const role of roles) {
      expect(role.models).toContain('google/gemini-3.8-flash');
    }
    const incapable = chatRoles(['aion-labs/aion-rp-llama-3.1-8b']);
    expect(incapable.find((role) => role.id === 'vision')?.models).toEqual([]);
    expect(
      incapable.find((role) => role.id === 'identification')?.models,
    ).toEqual([]);
  });
});

describe('catalog', () => {
  it('defaults to the union of the mode table and honours SPECSYNC_CHAT_MODELS', () => {
    expect(chatModelIds(base).sort()).toEqual([
      'anthropic/claude-sonnet-5',
      'google/gemini-3.1-pro-preview',
      'google/gemini-3.5-flash-lite',
      'google/gemini-3.8-flash',
    ]);
    expect(
      chatModelIds({
        ...base,
        SPECSYNC_CHAT_MODELS: ' google/gemini-3.8-flash , openai/gpt-5.6-luna ',
      }),
    ).toEqual(['google/gemini-3.8-flash', 'openai/gpt-5.6-luna']);
  });

  it('labels a model without its vendor prefix and names the vendor separately', () => {
    expect(
      chatModels({ ...base, SPECSYNC_CHAT_MODELS: 'openai/gpt-5.6-luna' }),
    ).toEqual([
      {
        id: 'openai/gpt-5.6-luna',
        label: 'GPT 5.6 Luna',
        vendor: 'openai',
        provider: 'openrouter',
      },
    ]);
    expect(labelOf('anthropic/claude-sonnet-5')).toBe('Claude Sonnet 5');
    expect(labelOf('low')).toBe('Low');
  });

  it('names the modes and the model each is estimated on', () => {
    expect(chatModes().map((mode) => mode.id)).toEqual([
      'velocity',
      'normal',
      'intelligent',
      'auto',
    ]);
    expect(chatModelOfMode('intelligent')).toBe('anthropic/claude-sonnet-5');
    expect(modesOfModel('anthropic/claude-sonnet-5')).toEqual(['intelligent']);
    expect(modesOfModel('google/gemini-3.8-flash')).toEqual([
      'normal',
      'intelligent',
    ]);
    expect(modesOfModel('openai/gpt-5.6-luna')).toEqual([]);
  });

  it('offers the reasoning efforts unchanged', () => {
    expect(chatEfforts()).toEqual([
      { id: 'auto', label: 'Auto' },
      { id: 'low', label: 'Low' },
      { id: 'medium', label: 'Medium' },
      { id: 'high', label: 'High' },
    ]);
  });
});

describe('auto mode', () => {
  it('picks intelligent for a long prompt', () => {
    expect(
      resolveAutoMode({ prompt: 'a'.repeat(AUTO_LONG_PROMPT_CHARS) }),
    ).toBe('normal');
    expect(
      resolveAutoMode({ prompt: 'a'.repeat(AUTO_LONG_PROMPT_CHARS + 1) }),
    ).toBe('intelligent');
  });

  it('picks intelligent for a comparison across more than two vehicles', () => {
    expect(comparesManyVehicles('Compare the Ranger and the Hilux')).toBe(
      false,
    );
    expect(
      comparesManyVehicles('Compare the Ranger, the Hilux and the Frontier'),
    ).toBe(true);
    expect(
      resolveAutoMode({
        prompt: 'Comparar Ranger, Hilux e Frontier',
      }),
    ).toBe('intelligent');
    // No comparison verb: a list alone is not a comparison.
    expect(comparesManyVehicles('Ranger, Hilux and Frontier')).toBe(false);
  });

  it('picks intelligent after a failed turn, even for a short prompt', () => {
    expect(
      resolveAutoMode({ prompt: 'and now?', previousTurnFailed: true }),
    ).toBe('intelligent');
  });

  it('picks velocity for a short prompt in a thread without ingestion', () => {
    expect(resolveAutoMode({ prompt: 'Ranger price?' })).toBe('velocity');
    expect(
      resolveAutoMode({ prompt: 'Ranger price?', usedIngestionTool: true }),
    ).toBe('normal');
  });

  it('picks normal otherwise', () => {
    expect(
      resolveAutoMode({ prompt: 'a'.repeat(AUTO_SHORT_PROMPT_CHARS) }),
    ).toBe('normal');
  });
});

describe('reasoning effort', () => {
  it('keeps the Vertex discovery role on the Google thinking config', () => {
    const vertexModel = { provider: 'vertex' as const, id: 'gemini-2.5-flash' };
    expect(chatProviderOptions(vertexModel, undefined)).toEqual({
      google: { thinkingConfig: { includeThoughts: true } },
    });
    expect(chatProviderOptions(vertexModel, 'high')).toEqual({
      google: {
        thinkingConfig: { includeThoughts: true, thinkingBudget: 24576 },
      },
    });
  });

  it('maps the effort per vendor and also under the key OpenRouter reads', () => {
    // The vendor keys are the contract's mapping; Mastra 1.64 forwards only
    // `providerOptions.openrouter` to an OpenRouter-routed model, so the same
    // effort is emitted there too or it would never reach the wire.
    expect(
      chatProviderOptions(
        { provider: 'openrouter', id: 'google/gemini-3.8-flash' },
        'low',
      ),
    ).toEqual({
      google: {
        thinkingConfig: { includeThoughts: true, thinkingLevel: 'low' },
      },
      openrouter: { reasoning: { effort: 'low' } },
    });
    expect(
      chatProviderOptions(
        { provider: 'openrouter', id: 'google/gemini-2.5-flash' },
        'medium',
      ),
    ).toEqual({
      google: {
        thinkingConfig: { includeThoughts: true, thinkingBudget: 8192 },
      },
      openrouter: { reasoning: { max_tokens: 8192 } },
    });
    expect(
      chatProviderOptions(
        { provider: 'openrouter', id: 'anthropic/claude-sonnet-5' },
        'high',
      ),
    ).toEqual({
      anthropic: { reasoningEffort: 'high' },
      openrouter: { reasoning: { effort: 'high' } },
    });
    expect(
      chatProviderOptions(
        { provider: 'openrouter', id: 'openai/gpt-5.6-luna' },
        'medium',
      ),
    ).toEqual({
      openai: { reasoningEffort: 'medium' },
      openrouter: { reasoning: { effort: 'medium' } },
    });
  });

  it('leaves the amount of thinking to the provider for auto and unknown efforts', () => {
    expect(
      chatProviderOptions(
        { provider: 'openrouter', id: 'openai/gpt-5.6-luna' },
        'auto',
      ),
    ).toEqual({});
    expect(
      chatProviderOptions(
        { provider: 'openrouter', id: 'openai/gpt-5.6-luna' },
        'max',
      ),
    ).toEqual({});
    expect(
      chatProviderOptions(
        { provider: 'openrouter', id: 'google/gemini-3.8-flash' },
        undefined,
      ),
    ).toEqual({ google: { thinkingConfig: { includeThoughts: true } } });
  });

  it('reads the effort and the run mode from the request context', () => {
    expect(
      chatProviderOptionsFor(
        contextWith({
          [CHAT_RESOLVED_MODE_KEY]: 'intelligent',
          [CHAT_EFFORT_KEY]: 'high',
        }),
      ),
    ).toEqual({
      anthropic: { reasoningEffort: 'high' },
      openrouter: { reasoning: { effort: 'high' } },
    });
  });
});
