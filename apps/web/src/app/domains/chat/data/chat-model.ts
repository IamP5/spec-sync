import { z } from 'zod';

/**
 * Model catalog route of the AI service, reached through the `/ai` proxy of
 * the web server. Part of the contract with `apps/ai` (`CHAT_MODELS_PATH` in
 * `src/mastra/chat-model-route.ts`).
 */
export const CHAT_MODELS_URL = '/ai/chat/models';

/**
 * Key of the AG-UI `forwardedProps` that carries the model the user picked.
 * Part of the contract with `apps/ai` (`CHAT_MODEL_PROPERTY`); the CopilotKit
 * route there reads it and the chat agent runs on that model.
 */
export const CHAT_MODEL_PROPERTY = 'model';

/**
 * Key of the AG-UI `forwardedProps` that carries the reasoning effort the
 * user picked. Part of the contract with `apps/ai` (`CHAT_EFFORT_PROPERTY`);
 * the service maps it to the thinking settings of the model's provider.
 */
export const CHAT_EFFORT_PROPERTY = 'effort';

export const chatModelOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  provider: z.enum(['vertex', 'openai']),
});

export const chatEffortOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

/**
 * What the AI service can run on right now and what it runs on by default:
 * the models, and the reasoning efforts it can apply to any of them.
 */
export const chatModelCatalogSchema = z.object({
  defaultModelId: z.string().min(1),
  models: z.array(chatModelOptionSchema),
  defaultEffortId: z.string().min(1),
  efforts: z.array(chatEffortOptionSchema),
});

export type ChatModelOption = z.infer<typeof chatModelOptionSchema>;
export type ChatEffortOption = z.infer<typeof chatEffortOptionSchema>;
export type ChatModelCatalog = z.infer<typeof chatModelCatalogSchema>;

const PROVIDER_LABELS: Record<ChatModelOption['provider'], string> = {
  vertex: 'Google',
  openai: 'OpenAI',
};

export function providerLabelOf(provider: ChatModelOption['provider']): string {
  return PROVIDER_LABELS[provider];
}

/**
 * The model to send with a run: the stored preference when the service still
 * offers it, otherwise nothing, which lets the service pick its default.
 */
export function effectiveModel(
  preference: string,
  catalog: ChatModelCatalog | undefined,
): string {
  if (!catalog) {
    return preference;
  }
  return catalog.models.some((model) => model.id === preference)
    ? preference
    : '';
}

/**
 * The reasoning effort to send with a run: the stored preference when the
 * service still offers it, otherwise nothing, which lets the service decide.
 */
export function effectiveEffort(
  preference: string,
  catalog: ChatModelCatalog | undefined,
): string {
  if (!catalog) {
    return preference;
  }
  return catalog.efforts.some((effort) => effort.id === preference)
    ? preference
    : '';
}
