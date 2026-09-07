import { createVertex } from '@ai-sdk/google-vertex';
import type { AgentExecutionOptions } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';

/**
 * Gemini served by Vertex AI. Mastra has no `vertex/...` router string, so the
 * AI SDK provider instance is passed to the agents directly.
 *
 * Authentication is Google Application Default Credentials: the runtime
 * service account on Cloud Run, `gcloud auth application-default login` on a
 * developer machine. No key is ever configured here. Project and location come
 * from GOOGLE_VERTEX_PROJECT / GOOGLE_VERTEX_LOCATION (read by the provider).
 */
const DEFAULT_MODEL = 'gemini-2.5-flash';

/** Gemini models offered in the chat when VERTEX_MODELS is not set. */
const DEFAULT_VERTEX_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];

/** OpenAI models offered in the chat when OPENAI_MODELS is not set. */
const DEFAULT_OPENAI_MODELS = ['gpt-5.6-luna'];

export const vertex = createVertex();

export const modelId = process.env['VERTEX_MODEL'] ?? DEFAULT_MODEL;

export const gemini = vertex(modelId);

/**
 * Request context key under which the CopilotKit route stores the model the
 * browser asked for (see `chat-model-route.ts`). The chat agent resolves its
 * model from it on every run.
 */
export const CHAT_MODEL_KEY = 'chat-model';

/**
 * Request context key under which the CopilotKit route stores the reasoning
 * effort the browser asked for. `chatProviderOptionsFor` maps it to the
 * thinking settings of the provider that serves the run's model.
 */
export const CHAT_EFFORT_KEY = 'chat-effort';

/** Effort id that leaves the amount of thinking to the provider. */
export const DEFAULT_EFFORT_ID = 'auto';

const EFFORT_LEVELS = ['low', 'medium', 'high'] as const;

export type ChatEffortLevel = (typeof EFFORT_LEVELS)[number];

/** One entry of the effort selector; the id is part of the contract with apps/web. */
export interface ChatEffortOption {
  id: string;
  label: string;
}

/**
 * Thinking budgets (tokens) for the Gemini 2.5 family, which has no thinking
 * level; every 2.5 model accepts these within its own range.
 */
const GEMINI_THINKING_BUDGETS: Record<ChatEffortLevel, number> = {
  low: 1024,
  medium: 8192,
  high: 24576,
};

export type ChatModelProvider = 'vertex' | 'openai';

/** One entry of the model selector; the id is part of the contract with apps/web. */
export interface ChatModelOption {
  id: string;
  label: string;
  provider: ChatModelProvider;
}

/**
 * Models the chat can run on right now. Gemini models come from
 * `VERTEX_MODELS` (comma separated, always including `VERTEX_MODEL`); OpenAI
 * models from `OPENAI_MODELS` and only while `OPENAI_API_KEY` is set, since
 * Mastra's model router reads the key from that variable.
 */
export function chatModels(
  env: NodeJS.ProcessEnv = process.env,
): ChatModelOption[] {
  const defaultId = env['VERTEX_MODEL'] ?? DEFAULT_MODEL;
  const geminiIds = new Set([
    defaultId,
    ...listOf(env['VERTEX_MODELS'], DEFAULT_VERTEX_MODELS),
  ]);
  const gemini = [...geminiIds].map((id) => ({
    id,
    label: labelOf(id),
    provider: 'vertex' as const,
  }));
  if (!env['OPENAI_API_KEY']) {
    return gemini;
  }
  const openai = listOf(env['OPENAI_MODELS'], DEFAULT_OPENAI_MODELS).map(
    (id) => ({ id, label: labelOf(id), provider: 'openai' as const }),
  );
  return [...gemini, ...openai];
}

/**
 * The model the chat agent runs on for `id`. Gemini ids resolve to the Vertex
 * provider instance (Application Default Credentials); OpenAI ids to Mastra's
 * `openai/<id>` router string. An unknown or missing id falls back to the
 * default model, so a stale browser preference never breaks a run.
 */
export function resolveChatModel(
  id: unknown,
  env: NodeJS.ProcessEnv = process.env,
) {
  const option =
    typeof id === 'string'
      ? chatModels(env).find((model) => model.id === id)
      : undefined;
  if (!option) {
    return gemini;
  }
  return option.provider === 'openai'
    ? (`openai/${option.id}` as const)
    : vertex(option.id);
}

/** Model for a run, from the id the CopilotKit route put into the request context. */
export function chatModelFor(requestContext: RequestContext) {
  return resolveChatModel(requestContext.get(CHAT_MODEL_KEY));
}

/** Reasoning efforts the chat offers for any model; `auto` is the provider default. */
export function chatEfforts(): ChatEffortOption[] {
  return [
    { id: DEFAULT_EFFORT_ID, label: 'Auto' },
    ...EFFORT_LEVELS.map((id) => ({ id, label: labelOf(id) })),
  ];
}

/**
 * Provider options for a run on model `id` with reasoning effort `effort`.
 * Gemini always streams its thought summaries; a picked effort becomes a
 * thinking level on Gemini 3.x and a thinking budget on Gemini 2.5, and the
 * reasoning effort on OpenAI. `auto`, unknown or missing efforts leave the
 * amount of thinking to the provider.
 */
export function chatProviderOptions(
  id: unknown,
  effort: unknown,
  env: NodeJS.ProcessEnv = process.env,
): NonNullable<AgentExecutionOptions['providerOptions']> {
  const option =
    typeof id === 'string'
      ? chatModels(env).find((model) => model.id === id)
      : undefined;
  const modelId = option?.id ?? env['VERTEX_MODEL'] ?? DEFAULT_MODEL;
  const level = EFFORT_LEVELS.find((candidate) => candidate === effort);
  if (option?.provider === 'openai') {
    return level ? { openai: { reasoningEffort: level } } : {};
  }
  const thinkingConfig: {
    includeThoughts: boolean;
    thinkingLevel?: ChatEffortLevel;
    thinkingBudget?: number;
  } = { includeThoughts: true };
  if (level && /^gemini-3/.test(modelId)) {
    thinkingConfig.thinkingLevel = level;
  } else if (level) {
    thinkingConfig.thinkingBudget = GEMINI_THINKING_BUDGETS[level];
  }
  return { google: { thinkingConfig } };
}

/** Provider options for a run, from the ids the CopilotKit route put into the request context. */
export function chatProviderOptionsFor(requestContext: RequestContext) {
  return chatProviderOptions(
    requestContext.get(CHAT_MODEL_KEY),
    requestContext.get(CHAT_EFFORT_KEY),
  );
}

function listOf(value: string | undefined, fallback: string[]): string[] {
  const ids = (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length ? ids : fallback;
}

/** "gemini-2.5-flash" → "Gemini 2.5 Flash", "gpt-5.6-luna" → "GPT 5.6 Luna", "low" → "Low". */
function labelOf(id: string): string {
  return id
    .split('-')
    .map((part) =>
      part === 'gpt'
        ? 'GPT'
        : /^\d/.test(part)
          ? part
          : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(' ');
}
