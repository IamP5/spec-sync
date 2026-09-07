import {
  CHAT_EFFORT_PROPERTY,
  CHAT_MODEL_PROPERTY,
  CHAT_MODELS_URL,
  type ChatModelCatalog,
  chatModelCatalogSchema,
  effectiveEffort,
  effectiveModel,
  providerLabelOf,
} from './chat-model';

const catalog: ChatModelCatalog = {
  defaultModelId: 'gemini-2.5-flash',
  models: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'vertex' },
    { id: 'gpt-5.6-luna', label: 'GPT 5.6 Luna', provider: 'openai' },
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
    expect(CHAT_MODEL_PROPERTY).toBe('model');
    expect(CHAT_EFFORT_PROPERTY).toBe('effort');
  });

  it('accepts the catalog the service returns and rejects unknown providers', () => {
    expect(chatModelCatalogSchema.parse(catalog)).toEqual(catalog);
    expect(() =>
      chatModelCatalogSchema.parse({
        ...catalog,
        models: [{ id: 'x', label: 'X', provider: 'other' }],
      }),
    ).toThrow();
  });

  it('sends the preference only while the service still offers it', () => {
    expect(effectiveModel('gpt-5.6-luna', catalog)).toBe('gpt-5.6-luna');
    expect(effectiveModel('gemini-99', catalog)).toBe('');
    expect(effectiveModel('', catalog)).toBe('');
    // Catalog not loaded yet: trust the preference, the service validates it.
    expect(effectiveModel('gpt-5.6-luna', undefined)).toBe('gpt-5.6-luna');
  });

  it('sends the effort only while the service still offers it', () => {
    expect(effectiveEffort('high', catalog)).toBe('high');
    expect(effectiveEffort('max', catalog)).toBe('');
    expect(effectiveEffort('', catalog)).toBe('');
    expect(effectiveEffort('high', undefined)).toBe('high');
  });

  it('names providers for the selector', () => {
    expect(providerLabelOf('vertex')).toBe('Google');
    expect(providerLabelOf('openai')).toBe('OpenAI');
  });
});
