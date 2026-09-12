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
  effortForRole,
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

function inMode(mode: string): RequestContext {
  return contextWith({ [CHAT_RESOLVED_MODE_KEY]: mode });
}

afterEach(() => {
  resetTariffCache();
});

describe('role registry', () => {
  it('routes chat, vision, identification, extraction and title through OpenRouter', () => {
    for (const role of [
      'chat',
      'vision',
      'identification',
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

  it('keeps both grounding roles on the Vertex provider instance so Google Search works', () => {
    for (const role of ['discovery', 'contentDiscovery'] as const) {
      expect(resolvedModelForRole(role, undefined, base)).toEqual({
        provider: 'vertex',
        id: 'gemini-3.8-flash',
      });
      const model = modelForRole(role, undefined, base);
      expect(typeof model).toBe('object');
      expect((model as { provider: string }).provider).toContain('vertex');
      expect((model as { modelId: string }).modelId).toBe('gemini-3.8-flash');
    }
  });

  it('resolves a role to the Balanced entry without a request context', () => {
    // The curator workflow and the thread titles run outside a chat request;
    // they must never follow a user's tier.
    expect(resolvedModelForRole('chat', undefined, base).id).toBe(
      'openai/gpt-5.6-luna',
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
    expect(
      resolvedModelForRole('discovery', undefined, {
        ...base,
        SPECSYNC_DISCOVERY_MODEL: 'gemini-2.5-flash',
      }),
    ).toEqual({ provider: 'vertex', id: 'gemini-2.5-flash' });
  });

  it('maps each tier to its models', () => {
    const rolesOf = (mode: string) =>
      Object.fromEntries(
        (
          [
            'chat',
            'vision',
            'identification',
            'contentDiscovery',
            'discovery',
            'extraction',
          ] as const
        ).map((role) => [
          role,
          resolvedModelForRole(role, inMode(mode), base).id,
        ]),
      );
    expect(rolesOf('velocity')).toEqual({
      chat: 'openai/gpt-5.6-luna',
      vision: 'google/gemini-3.8-flash',
      identification: 'google/gemini-3.8-flash',
      contentDiscovery: 'gemini-2.5-flash',
      discovery: 'gemini-2.5-flash',
      extraction: 'google/gemini-3.8-flash',
    });
    expect(rolesOf('normal')).toEqual({
      chat: 'openai/gpt-5.6-luna',
      vision: 'google/gemini-3.8-flash',
      identification: 'google/gemini-3.8-flash',
      contentDiscovery: 'gemini-3.8-flash',
      discovery: 'gemini-3.8-flash',
      extraction: 'google/gemini-3.8-flash',
    });
    expect(rolesOf('intelligent')).toEqual({
      chat: 'openai/gpt-5.6-sol',
      vision: 'google/gemini-3.8-flash',
      identification: 'google/gemini-3.8-flash',
      contentDiscovery: 'gemini-3.1-pro-preview',
      discovery: 'gemini-3.1-pro-preview',
      extraction: 'google/gemini-3.8-flash',
    });
  });

  it('fixes the reasoning effort of every role per tier', () => {
    const effortsOf = (mode: string) =>
      Object.fromEntries(
        (
          [
            'chat',
            'vision',
            'identification',
            'contentDiscovery',
            'discovery',
            'extraction',
            'title',
          ] as const
        ).map((role) => [role, effortForRole(role, inMode(mode), base)]),
      );
    expect(effortsOf('velocity')).toEqual({
      chat: 'low',
      vision: 'low',
      identification: 'low',
      contentDiscovery: undefined,
      discovery: undefined,
      extraction: undefined,
      title: undefined,
    });
    expect(effortsOf('normal')).toEqual({
      chat: 'high',
      vision: 'medium',
      identification: 'medium',
      contentDiscovery: undefined,
      discovery: undefined,
      extraction: undefined,
      title: undefined,
    });
    expect(effortsOf('intelligent')).toEqual({
      chat: 'medium',
      vision: 'high',
      identification: 'high',
      contentDiscovery: undefined,
      discovery: undefined,
      extraction: 'high',
      title: undefined,
    });
    // No context: the Balanced entry, which is what the curator workflow
    // transcribes and identifies with.
    expect(effortForRole('vision', undefined, base)).toBe('medium');
    expect(effortForRole('extraction', undefined, base)).toBeUndefined();
  });

  it('lets a previous-release effort property override the chat effort only', () => {
    const requestContext = contextWith({
      [CHAT_RESOLVED_MODE_KEY]: 'velocity',
      [CHAT_EFFORT_KEY]: 'high',
    });
    expect(effortForRole('chat', requestContext, base)).toBe('high');
    expect(effortForRole('vision', requestContext, base)).toBe('low');
    expect(
      effortForRole(
        'chat',
        contextWith({
          [CHAT_RESOLVED_MODE_KEY]: 'velocity',
          [CHAT_EFFORT_KEY]: 'auto',
        }),
        base,
      ),
    ).toBe('low');
  });

  it('keeps title outside the tier table', () => {
    expect(resolvedModelForRole('title', inMode('intelligent'), base).id).toBe(
      'openai/gpt-5.6-luna',
    );
  });

  it('prefers the pinned tier over the one the browser asked for', () => {
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

  it('honours an override of the chat role and keeps the tier effort', () => {
    const requestContext = contextWith({
      [CHAT_RESOLVED_MODE_KEY]: 'velocity',
      [CHAT_ROLE_MODELS_KEY]: { chat: 'openai/gpt-5.6-sol' },
    });
    expect(roleOverrideOf('chat', requestContext, env)).toBe(
      'openai/gpt-5.6-sol',
    );
    expect(resolvedModelForRole('chat', requestContext, env).id).toBe(
      'openai/gpt-5.6-sol',
    );
    expect(effortForRole('chat', requestContext, env)).toBe('low');
  });

  it('ignores overrides of the roles the user does not configure', () => {
    const requestContext = contextWith({
      [CHAT_ROLE_MODELS_KEY]: {
        vision: 'openai/gpt-5.6-sol',
        identification: 'openai/gpt-5.6-sol',
        contentDiscovery: 'openai/gpt-5.6-sol',
        extraction: 'openai/gpt-5.6-sol',
        title: 'openai/gpt-5.6-sol',
        discovery: 'openai/gpt-5.6-sol',
      },
    });
    for (const role of [
      'vision',
      'identification',
      'contentDiscovery',
      'extraction',
      'title',
      'discovery',
    ] as const) {
      expect(roleOverrideOf(role, requestContext, env)).toBeUndefined();
    }
    expect(resolvedModelForRole('vision', requestContext, env).id).toBe(
      'google/gemini-3.8-flash',
    );
    expect(
      resolvedModelForRole('contentDiscovery', requestContext, env),
    ).toEqual({ provider: 'vertex', id: 'gemini-3.8-flash' });
  });

  it('ignores an override outside the catalog rather than failing the run', () => {
    const requestContext = contextWith({
      [CHAT_ROLE_MODELS_KEY]: { chat: 'meta-llama/llama-4' },
    });
    expect(roleOverrideOf('chat', requestContext, env)).toBeUndefined();
    expect(resolvedModelForRole('chat', requestContext, env).id).toBe(
      'openai/gpt-5.6-luna',
    );
  });

  it('offers the chat role only', () => {
    const roles = chatRoles(['openai/gpt-5.6-luna', 'openai/gpt-5.6-sol']);
    expect(roles).toEqual([
      {
        id: 'chat',
        label: 'Chat',
        models: ['openai/gpt-5.6-luna', 'openai/gpt-5.6-sol'],
      },
    ]);
  });
});

describe('catalog', () => {
  it('defaults to the chat models of the tier table and honours SPECSYNC_CHAT_MODELS', () => {
    expect(chatModelIds(base)).toEqual([
      'openai/gpt-5.6-luna',
      'openai/gpt-5.6-sol',
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

  it('names the tiers and the model each is estimated on', () => {
    expect(chatModes()).toEqual([
      {
        id: 'velocity',
        label: 'Instant',
        description: 'Quick answers at the lowest cost.',
      },
      {
        id: 'normal',
        label: 'Balanced',
        description: 'Thorough answers for everyday questions.',
      },
      {
        id: 'intelligent',
        label: 'Deep',
        description: 'The strongest reasoning for hard comparisons.',
      },
      {
        id: 'auto',
        label: 'Auto',
        description: 'Picks a level from your message.',
      },
    ]);
    expect(chatModelOfMode('intelligent')).toBe('openai/gpt-5.6-sol');
    expect(modesOfModel('openai/gpt-5.6-sol')).toEqual(['intelligent']);
    expect(modesOfModel('openai/gpt-5.6-luna')).toEqual(['velocity', 'normal']);
    // Named by tiers for other roles only: never a chat tier.
    expect(modesOfModel('google/gemini-3.8-flash')).toEqual([]);
  });

  it('offers no reasoning efforts: the tier fixes them', () => {
    expect(chatEfforts()).toEqual([]);
  });
});

describe('auto mode', () => {
  it('picks Deep for a long prompt', () => {
    expect(
      resolveAutoMode({ prompt: 'a'.repeat(AUTO_LONG_PROMPT_CHARS) }),
    ).toBe('normal');
    expect(
      resolveAutoMode({ prompt: 'a'.repeat(AUTO_LONG_PROMPT_CHARS + 1) }),
    ).toBe('intelligent');
  });

  it('picks Deep for a comparison across more than two vehicles', () => {
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

  it('picks Deep after a failed turn, even for a short prompt', () => {
    expect(
      resolveAutoMode({ prompt: 'and now?', previousTurnFailed: true }),
    ).toBe('intelligent');
  });

  it('picks Instant for a short prompt in a thread without ingestion', () => {
    expect(resolveAutoMode({ prompt: 'Ranger price?' })).toBe('velocity');
    expect(
      resolveAutoMode({ prompt: 'Ranger price?', usedIngestionTool: true }),
    ).toBe('normal');
  });

  it('picks Balanced otherwise', () => {
    expect(
      resolveAutoMode({ prompt: 'a'.repeat(AUTO_SHORT_PROMPT_CHARS) }),
    ).toBe('normal');
  });
});

describe('reasoning effort', () => {
  it('keeps a Vertex role on the Google thinking config', () => {
    const vertexModel = { provider: 'vertex' as const, id: 'gemini-2.5-flash' };
    expect(chatProviderOptions(vertexModel, undefined)).toEqual({
      google: { thinkingConfig: { includeThoughts: true } },
    });
    expect(chatProviderOptions(vertexModel, 'high')).toEqual({
      google: {
        thinkingConfig: { includeThoughts: true, thinkingBudget: 24576 },
      },
    });
    expect(
      chatProviderOptions(
        { provider: 'vertex', id: 'gemini-3.8-flash' },
        'medium',
        { thoughts: false },
      ),
    ).toEqual({ google: { thinkingConfig: { thinkingLevel: 'medium' } } });
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
        { provider: 'openrouter', id: 'openai/gpt-5.6-luna' },
        'medium',
      ),
    ).toEqual({
      openai: { reasoningEffort: 'medium' },
      openrouter: { reasoning: { effort: 'medium' } },
    });
  });

  it('asks OpenRouter to cache the prompt of an Anthropic model', () => {
    // OpenAI and Gemini cache a repeated prefix on their own; Anthropic only
    // with a breakpoint, which OpenRouter places for us from this top-level
    // field. Emitted with or without an effort.
    expect(
      chatProviderOptions(
        { provider: 'openrouter', id: 'anthropic/claude-sonnet-5' },
        'high',
      ),
    ).toEqual({
      anthropic: { reasoningEffort: 'high' },
      openrouter: {
        reasoning: { effort: 'high' },
        cache_control: { type: 'ephemeral' },
      },
    });
    expect(
      chatProviderOptions(
        { provider: 'openrouter', id: 'anthropic/claude-sonnet-5' },
        undefined,
      ),
    ).toEqual({
      openrouter: { cache_control: { type: 'ephemeral' } },
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

  it('reads the tier from the request context for every role', () => {
    const deep = inMode('intelligent');
    expect(chatProviderOptionsFor(deep)).toEqual({
      openai: { reasoningEffort: 'medium' },
      openrouter: { reasoning: { effort: 'medium' } },
    });
    // Structured-output roles do not stream thought summaries.
    expect(chatProviderOptionsFor(deep, 'vision')).toEqual({
      google: { thinkingConfig: { thinkingLevel: 'high' } },
      openrouter: { reasoning: { effort: 'high' } },
    });
    expect(chatProviderOptionsFor(deep, 'identification')).toEqual({
      google: { thinkingConfig: { thinkingLevel: 'high' } },
      openrouter: { reasoning: { effort: 'high' } },
    });
    expect(
      chatProviderOptionsFor(inMode('velocity'), 'identification'),
    ).toEqual({
      google: { thinkingConfig: { thinkingLevel: 'low' } },
      openrouter: { reasoning: { effort: 'low' } },
    });
    // Vertex roles carry only the vendor key, and no fixed effort.
    expect(chatProviderOptionsFor(deep, 'discovery')).toEqual({
      google: { thinkingConfig: {} },
    });
    expect(chatProviderOptionsFor(undefined, 'extraction')).toEqual({
      google: { thinkingConfig: {} },
    });
  });
});
