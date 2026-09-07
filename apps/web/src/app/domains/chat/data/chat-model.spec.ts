import {
  CHAT_EFFORT_PROPERTY,
  CHAT_MODE_PROPERTY,
  CHAT_MODELS_URL,
  CHAT_ROLE_MODELS_PROPERTY,
  type ChatModelCatalog,
  chatModelCatalogSchema,
  effectiveEffort,
  effectiveMode,
  effectiveRoleModels,
  messagesCovered,
  needsCostConfirmation,
  vendorLabelOf,
} from './chat-model';

const catalog: ChatModelCatalog = {
  defaultModeId: 'normal',
  resolvedMode: null,
  modes: [
    {
      id: 'velocity',
      label: 'Velocity',
      description: 'Fastest answers, lowest cost.',
      chatModelId: 'google/gemini-3.5-flash-lite',
      estimatedCredits: 615_000,
      relativeCost: 0.5,
      affordable: true,
    },
    {
      id: 'normal',
      label: 'Normal',
      description: 'The everyday balance.',
      chatModelId: 'google/gemini-3.8-flash',
      estimatedCredits: 1_162_500,
      relativeCost: 1,
      affordable: true,
    },
    {
      id: 'intelligent',
      label: 'Intelligent',
      description: 'A better reasoner for hard questions.',
      chatModelId: 'anthropic/claude-sonnet-5',
      estimatedCredits: 3_100_000,
      relativeCost: 2.7,
      affordable: true,
    },
    {
      id: 'auto',
      label: 'Auto',
      description: 'Picks a mode from your message.',
      chatModelId: null,
      estimatedCredits: null,
      relativeCost: null,
      affordable: true,
    },
  ],
  roles: [
    {
      id: 'chat',
      label: 'Chat',
      models: ['google/gemini-3.8-flash', 'anthropic/claude-sonnet-5'],
    },
    {
      id: 'vision',
      label: 'Document reading',
      models: ['google/gemini-3.8-flash'],
    },
  ],
  models: [
    {
      id: 'google/gemini-3.8-flash',
      label: 'Gemini 3.5 Flash',
      vendor: 'google',
      provider: 'openrouter',
    },
    {
      id: 'anthropic/claude-sonnet-5',
      label: 'Claude Sonnet 5',
      vendor: 'anthropic',
      provider: 'openrouter',
    },
  ],
  defaultEffortId: 'auto',
  efforts: [
    { id: 'auto', label: 'Auto' },
    { id: 'high', label: 'High' },
  ],
};

describe('chat model contract', () => {
  it('keeps the names shared with the AI service', () => {
    expect(CHAT_MODELS_URL).toBe('/ai/chat/models');
    expect(CHAT_MODE_PROPERTY).toBe('mode');
    expect(CHAT_ROLE_MODELS_PROPERTY).toBe('roleModels');
    expect(CHAT_EFFORT_PROPERTY).toBe('effort');
  });

  it('accepts the catalog the service returns and rejects unknown modes', () => {
    expect(chatModelCatalogSchema.parse(catalog)).toEqual(catalog);
    expect(() =>
      chatModelCatalogSchema.parse({
        ...catalog,
        modes: [{ id: 'turbo', label: 'Turbo' }],
      }),
    ).toThrow();
  });

  it('fills in what the service may leave out of a mode', () => {
    const parsed = chatModelCatalogSchema.parse({
      defaultModeId: 'normal',
      modes: [{ id: 'normal', label: 'Normal' }],
      defaultEffortId: 'auto',
    });
    expect(parsed.modes[0]).toEqual({
      id: 'normal',
      label: 'Normal',
      description: '',
      chatModelId: null,
      estimatedCredits: null,
      relativeCost: null,
      affordable: null,
    });
    expect(parsed.resolvedMode).toBeNull();
    expect(parsed.roles).toEqual([]);
    expect(parsed.models).toEqual([]);
    expect(parsed.efforts).toEqual([]);
  });

  it('sends the mode only while the service still offers it', () => {
    expect(effectiveMode('intelligent', catalog)).toBe('intelligent');
    expect(
      effectiveMode('intelligent', {
        ...catalog,
        modes: catalog.modes.slice(0, 2),
      }),
    ).toBe('');
    expect(effectiveMode('', catalog)).toBe('');
    // Not a mode at all (a preference from another release).
    expect(effectiveMode('gemini-2.5-flash', catalog)).toBe('');
    // Catalog not loaded yet: trust the preference, the service validates it.
    expect(effectiveMode('velocity', undefined)).toBe('velocity');
  });

  it('sends only the overrides the service offers for that role', () => {
    expect(
      effectiveRoleModels(
        {
          chat: 'anthropic/claude-sonnet-5',
          // The service does not offer this model for `vision`.
          vision: 'anthropic/claude-sonnet-5',
          // Not a configurable role.
          title: 'google/gemini-3.8-flash',
          identification: '',
        },
        catalog,
      ),
    ).toEqual({ chat: 'anthropic/claude-sonnet-5' });
  });

  it('keeps the overrides while the catalog is not loaded and drops junk', () => {
    expect(
      effectiveRoleModels(
        { chat: 'anthropic/claude-sonnet-5', vision: '' },
        undefined,
      ),
    ).toEqual({ chat: 'anthropic/claude-sonnet-5' });
    expect(
      effectiveRoleModels(
        { nonsense: 'x' } as unknown as Record<string, string>,
        undefined,
      ),
    ).toEqual({});
  });

  it('sends the effort only while the service still offers it', () => {
    expect(effectiveEffort('high', catalog)).toBe('high');
    expect(effectiveEffort('max', catalog)).toBe('');
    expect(effectiveEffort('', catalog)).toBe('');
    expect(effectiveEffort('high', undefined)).toBe('high');
  });

  it('names vendors for the advanced selector', () => {
    expect(vendorLabelOf('google')).toBe('Google');
    expect(vendorLabelOf('openai')).toBe('OpenAI');
    expect(vendorLabelOf('anthropic')).toBe('Anthropic');
    expect(vendorLabelOf('deepseek')).toBe('Deepseek');
  });

  it('counts the reference turns the balance still covers', () => {
    expect(messagesCovered(8_160_000 * 12, 8_160_000)).toBe(12);
    expect(messagesCovered(8_160_000, null)).toBe(0);
    expect(messagesCovered(-1, 8_160_000)).toBe(0);
  });
});

describe('needsCostConfirmation', () => {
  const intelligent = catalog.modes[2];

  it('asks before a mode the wallet barely covers', () => {
    // 19 reference turns left on Intelligent.
    expect(needsCostConfirmation(intelligent, 3_100_000 * 19)).toBe(true);
  });

  it('stays out of the way on a full wallet', () => {
    expect(needsCostConfirmation(intelligent, 3_100_000 * 20)).toBe(false);
  });

  it('asks for a cheap mode too once the balance is nearly gone', () => {
    // Affordability is the whole trigger: a multiplier condition would never
    // fire on the real rate card, where Intelligent is only 2.7x Normal.
    expect(needsCostConfirmation(catalog.modes[0], 0)).toBe(true);
    expect(needsCostConfirmation(catalog.modes[1], 0)).toBe(true);
  });

  it('never asks for Auto, which has no estimate of its own', () => {
    expect(needsCostConfirmation(catalog.modes[3], 0)).toBe(false);
  });

  it('never asks while the wallet is unknown', () => {
    expect(needsCostConfirmation(intelligent, undefined)).toBe(false);
    expect(needsCostConfirmation(undefined, 0)).toBe(false);
  });
});
