import {
  CHAT_EFFORT_PROPERTY,
  CHAT_MODE_PROPERTY,
  CHAT_MODELS_URL,
  type ChatModelCatalog,
  chatModelCatalogSchema,
  effectiveEffort,
  effectiveMode,
  messagesCovered,
  needsCostConfirmation,
} from './chat-model';

const catalog: ChatModelCatalog = {
  defaultModeId: 'normal',
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
    expect(CHAT_EFFORT_PROPERTY).toBe('effort');
  });

  it('accepts the catalog the service returns and drops modes it does not offer', () => {
    expect(chatModelCatalogSchema.parse(catalog)).toEqual(catalog);
    // Auto and anything else the service may add stay out of the composer
    // without failing the read.
    expect(
      chatModelCatalogSchema.parse({
        ...catalog,
        modes: [
          ...catalog.modes,
          { id: 'auto', label: 'Auto' },
          { id: 'turbo', label: 'Turbo' },
        ],
      }).modes,
    ).toEqual(catalog.modes);
    // A default the browser does not know falls back to its own.
    expect(
      chatModelCatalogSchema.parse({ ...catalog, defaultModeId: 'auto' })
        .defaultModeId,
    ).toBe('normal');
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

  it('sends the effort only while the service still offers it', () => {
    expect(effectiveEffort('high', catalog)).toBe('high');
    expect(effectiveEffort('max', catalog)).toBe('');
    expect(effectiveEffort('', catalog)).toBe('');
    expect(effectiveEffort('high', undefined)).toBe('high');
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
