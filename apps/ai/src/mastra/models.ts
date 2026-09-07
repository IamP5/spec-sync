import { createVertex } from '@ai-sdk/google-vertex';
import type { AgentExecutionOptions } from '@mastra/core/agent';
import {
  modelSupportsAttachments,
  modelSupportsStructuredOutput,
} from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';

import { cachedTariffModelIds } from './credits/credits-client';

/**
 * The one place that decides which model serves which job.
 *
 * Every model call goes through OpenRouter (`openrouter/<vendor>/<model>`,
 * key from OPENROUTER_API_KEY) except Google Search grounding, which stays on
 * Vertex AI because `vertex.tools.googleSearch({})` has no OpenRouter
 * equivalent. That exception is temporary; when grounding can be routed the
 * Vertex provider leaves the codebase entirely.
 *
 * Vertex is reached with Application Default Credentials — the runtime service
 * account on Cloud Run, `gcloud auth application-default login` on a developer
 * machine. No key is ever configured for it. Project and location come from
 * GOOGLE_VERTEX_PROJECT / GOOGLE_VERTEX_LOCATION (read by the provider).
 */
export const vertex = createVertex();

/** A job a model is picked for. See docs/openrouter-model-routing.md. */
export type ModelRole =
  | 'chat'
  | 'discovery'
  | 'vision'
  | 'identification'
  | 'contentDiscovery'
  | 'extraction'
  | 'title'
  | 'router';

/** The four modes the composer offers. A mode is a map from role to model. */
export type ChatMode = 'velocity' | 'normal' | 'intelligent' | 'auto';

/** A mode that names models directly; `auto` resolves to one of these per run. */
export type ResolvedChatMode = Exclude<ChatMode, 'auto'>;

export const CHAT_MODES: readonly ChatMode[] = [
  'velocity',
  'normal',
  'intelligent',
  'auto',
];

/** Mode a run uses when the browser sends none. */
export const DEFAULT_MODE_ID: ResolvedChatMode = 'normal';

/** The roles the mode table names; the others are configuration, not a mode. */
type ModeDrivenRole = 'chat' | 'vision' | 'identification';

/**
 * Model per mode and role. `vision` stays on Gemini in every mode: PDF
 * transcription is a tuned structured-output prompt validated by
 * `validateTranscript`, and swapping its model needs its own eval set first.
 * Intelligent buys a better reasoner, not a different transcriber.
 */
const MODE_TABLE: Record<ResolvedChatMode, Record<ModeDrivenRole, string>> = {
  velocity: {
    chat: 'google/gemini-3.5-flash-lite',
    vision: 'google/gemini-3.5-flash-lite',
    identification: 'google/gemini-3.5-flash-lite',
  },
  normal: {
    chat: 'google/gemini-3.8-flash',
    vision: 'google/gemini-3.8-flash',
    identification: 'google/gemini-3.8-flash',
  },
  intelligent: {
    chat: 'anthropic/claude-sonnet-5',
    vision: 'google/gemini-3.1-pro-preview',
    identification: 'google/gemini-3.8-flash',
  },
};

const MODE_LABELS: Record<ChatMode, string> = {
  velocity: 'Velocity',
  normal: 'Normal',
  intelligent: 'Intelligent',
  auto: 'Auto',
};

const MODE_DESCRIPTIONS: Record<ChatMode, string> = {
  velocity: 'Fastest answers, lowest cost.',
  normal: 'Balanced answers for everyday questions.',
  intelligent: 'A stronger reasoner for hard comparisons.',
  auto: 'Picks a mode from your message.',
};

/**
 * Gemini on Vertex AI serving `discovery`. Grounding is the one call this
 * service still makes outside OpenRouter, so its model is fixed rather than a
 * mode entry: the wallet is charged under `provider = 'vertex'` with this bare
 * model id, which therefore needs its own active tariff row.
 * `SPECSYNC_DISCOVERY_MODEL` overrides it.
 */
export const DEFAULT_DISCOVERY_MODEL = 'gemini-2.5-flash';

export function discoveryModelId(env: NodeJS.ProcessEnv = process.env): string {
  return env['SPECSYNC_DISCOVERY_MODEL'] ?? DEFAULT_DISCOVERY_MODEL;
}

/** Curator ingestion model; an operator setting, never a user's mode. */
const DEFAULT_EXTRACTION_MODEL = 'google/gemini-3.8-flash';

/** Thread titles; SpecSync's own budget, never charged to the user. */
const DEFAULT_TITLE_MODEL = 'openai/gpt-5.6-luna';

/**
 * Request context key under which the CopilotKit route stores the mode the
 * browser asked for (see `chat-model-route.ts`).
 */
export const CHAT_MODE_KEY = 'chat-mode';

/**
 * Request context key under which the CopilotKit route stores the mode a run
 * actually runs in. For `auto` the heuristic decides it once, before
 * admission, and pins it here so every role of the run agrees on it.
 */
export const CHAT_RESOLVED_MODE_KEY = 'chat-resolved-mode';

/** Request context key for the advanced per-role overrides (`roleModels`). */
export const CHAT_ROLE_MODELS_KEY = 'chat-role-models';

/**
 * Request context key under which the CopilotKit route stores the reasoning
 * effort the browser asked for. `chatProviderOptionsFor` maps it to the
 * thinking settings of the model that serves the run.
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

/** Where a role's model actually runs. `vertex` is grounding only. */
export type ChatModelProvider = 'openrouter' | 'vertex';

/** Provider and id of the model a role resolves to; what the wallet is charged against. */
export interface ResolvedModel {
  provider: ChatModelProvider;
  id: string;
}

/** One entry of the model catalog; the id is part of the contract with apps/web. */
export interface ChatModelOption {
  id: string;
  label: string;
  vendor: string;
  provider: ChatModelProvider;
}

/** One entry of the mode picker. */
export interface ChatModeOption {
  id: ChatMode;
  label: string;
  description: string;
}

/** The roles the advanced selector may override; the rest are not user-configurable. */
export const CONFIGURABLE_ROLES = [
  'chat',
  'vision',
  'identification',
  'contentDiscovery',
] as const;

export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

const ROLE_LABELS: Record<ConfigurableRole, string> = {
  chat: 'Chat',
  vision: 'Document reading',
  identification: 'Configuration identification',
  contentDiscovery: 'Content discovery',
};

export function chatModes(): ChatModeOption[] {
  return CHAT_MODES.map((id) => ({
    id,
    label: MODE_LABELS[id],
    description: MODE_DESCRIPTIONS[id],
  }));
}

export function modeLabelOf(mode: ChatMode): string {
  return MODE_LABELS[mode];
}

/** The `chat` model of a mode, which is what its cost estimate is computed on. */
export function chatModelOfMode(mode: ResolvedChatMode): string {
  return MODE_TABLE[mode].chat;
}

/** Modes a model belongs to, for the insufficient-credits message. */
export function modesOfModel(id: string): ResolvedChatMode[] {
  return (Object.keys(MODE_TABLE) as ResolvedChatMode[]).filter((mode) =>
    Object.values(MODE_TABLE[mode]).includes(id),
  );
}

/**
 * Models the advanced selector may offer. `SPECSYNC_CHAT_MODELS` (comma
 * separated OpenRouter ids) overrides the default, which is the union of the
 * models the mode table names.
 */
export function chatModelIds(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = listOf(env['SPECSYNC_CHAT_MODELS']);
  if (configured.length) {
    return configured;
  }
  const ids = new Set<string>();
  for (const mode of Object.values(MODE_TABLE)) {
    for (const id of Object.values(mode)) {
      ids.add(id);
    }
  }
  return [...ids];
}

/** The advanced catalog as the browser reads it. */
export function chatModels(env: NodeJS.ProcessEnv = process.env) {
  return chatModelIds(env).map(modelOptionOf);
}

function modelOptionOf(id: string): ChatModelOption {
  return {
    id,
    label: labelOf(id),
    vendor: vendorOf(id),
    provider: 'openrouter',
  };
}

/** One entry of the advanced per-role selector. */
export interface ChatRoleOption {
  id: ConfigurableRole;
  label: string;
  models: string[];
}

/**
 * The models each configurable role may be overridden with, filtered by the
 * capability the role needs: `vision` reads attachments, `identification`
 * needs structured output. Both flags come from Mastra's own capability
 * tables, so an id the router cannot serve for that job is never offered.
 */
export function chatRoles(ids: string[] = chatModelIds()): ChatRoleOption[] {
  return CONFIGURABLE_ROLES.map((id) => ({
    id,
    label: ROLE_LABELS[id],
    models: ids.filter((model) => roleCanRun(id, model)),
  }));
}

function roleCanRun(role: ModelRole, id: string): boolean {
  const router = routerStringOf(id);
  if (role === 'vision') {
    return modelSupportsAttachments(router) === true;
  }
  if (role === 'identification') {
    return modelSupportsStructuredOutput(router) === true;
  }
  return true;
}

/**
 * The mode a run uses. `auto` is resolved once before admission and pinned
 * into the request context, so every role of the run reads the same decision.
 * Without a request context — the curator workflow, thread titles — a run has
 * no mode and every role falls back to its default.
 */
export function modeOf(
  requestContext?: Pick<RequestContext, 'get'>,
): ResolvedChatMode {
  const resolved = requestContext?.get(CHAT_RESOLVED_MODE_KEY);
  if (isResolvedMode(resolved)) {
    return resolved;
  }
  const asked = requestContext?.get(CHAT_MODE_KEY);
  return isResolvedMode(asked) ? asked : DEFAULT_MODE_ID;
}

function isResolvedMode(value: unknown): value is ResolvedChatMode {
  return value === 'velocity' || value === 'normal' || value === 'intelligent';
}

export function isChatMode(value: unknown): value is ChatMode {
  return typeof value === 'string' && CHAT_MODES.includes(value as ChatMode);
}

/**
 * The advanced override for a role, or `undefined` when it follows the mode.
 * An override is honoured only while it names a model of the catalog that can
 * do the role's job and that the wallet can price; anything else is ignored,
 * never fatal, so a stale browser preference cannot break a run.
 */
export function roleOverrideOf(
  role: ModelRole,
  requestContext?: Pick<RequestContext, 'get'>,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!isConfigurable(role)) {
    return undefined;
  }
  const overrides = requestContext?.get(CHAT_ROLE_MODELS_KEY);
  const id = isRecord(overrides) ? overrides[role] : undefined;
  if (typeof id !== 'string' || !chatModelIds(env).includes(id)) {
    return undefined;
  }
  if (!roleCanRun(role, id)) {
    return undefined;
  }
  const priced = cachedTariffModelIds();
  return priced && !priced.has(`openrouter/${id}`) ? undefined : id;
}

function isConfigurable(role: ModelRole): role is ConfigurableRole {
  return (CONFIGURABLE_ROLES as readonly ModelRole[]).includes(role);
}

/**
 * Provider and id the role actually resolves to; what the wallet is charged
 * against. Called without a request context a role resolves to its default,
 * never to a user's mode — that is what keeps the curator workflow and the
 * thread titles on SpecSync's own budget.
 */
export function resolvedModelForRole(
  role: ModelRole,
  requestContext?: Pick<RequestContext, 'get'>,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedModel {
  if (role === 'discovery') {
    return { provider: 'vertex', id: discoveryModelId(env) };
  }
  return {
    provider: 'openrouter',
    id: openRouterIdFor(role, requestContext, env),
  };
}

function openRouterIdFor(
  role: Exclude<ModelRole, 'discovery'>,
  requestContext: Pick<RequestContext, 'get'> | undefined,
  env: NodeJS.ProcessEnv,
): string {
  const override = roleOverrideOf(role, requestContext, env);
  if (override) {
    return override;
  }
  switch (role) {
    case 'extraction':
      return env['SPECSYNC_EXTRACTION_MODEL'] ?? DEFAULT_EXTRACTION_MODEL;
    case 'title':
      return env['SPECSYNC_TITLE_MODEL'] ?? DEFAULT_TITLE_MODEL;
    // The classifier-backed router is a later change; until then it costs the
    // same as a normal chat turn, which is what its estimates assume.
    case 'router':
      return MODE_TABLE[DEFAULT_MODE_ID].chat;
    // Content discovery is not in the mode table: it follows `chat`.
    case 'contentDiscovery':
      return MODE_TABLE[modeOf(requestContext)].chat;
    default:
      return MODE_TABLE[modeOf(requestContext)][role];
  }
}

/**
 * The model a role runs on for this request. `discovery` returns the Vertex
 * provider instance, which is what keeps `vertex.tools.googleSearch({})`
 * working; every other role returns an OpenRouter router string.
 */
export function modelForRole(
  role: ModelRole,
  requestContext?: Pick<RequestContext, 'get'>,
  env: NodeJS.ProcessEnv = process.env,
) {
  const resolved = resolvedModelForRole(role, requestContext, env);
  return resolved.provider === 'vertex'
    ? vertex(resolved.id)
    : routerStringOf(resolved.id);
}

/** Mastra router string for an OpenRouter model id. */
export function routerStringOf(id: string): `openrouter/${string}` {
  return `openrouter/${id}`;
}

/** Reasoning efforts the chat offers for any model; `auto` is the provider default. */
export function chatEfforts(): ChatEffortOption[] {
  return [
    { id: DEFAULT_EFFORT_ID, label: 'Auto' },
    ...EFFORT_LEVELS.map((id) => ({ id, label: labelOf(id) })),
  ];
}

/**
 * Provider options for a run of `model` with reasoning effort `effort`.
 *
 * Gemini always streams its thought summaries; a picked effort becomes a
 * thinking level on Gemini 3.x, a thinking budget on Gemini 2.5 and a
 * reasoning effort on OpenAI and Anthropic (docs/openrouter-model-routing.md).
 *
 * Those vendor keys are what a direct provider instance reads, and the Vertex
 * `discovery` role is served by exactly that. A model routed through
 * OpenRouter is not: Mastra 1.64 resolves `openrouter/…` to its own OpenRouter
 * chat model, whose `doGenerate` spreads only `providerOptions.openrouter`
 * into the request body and drops every other key (verified against
 * @mastra/core 1.64). The same effort is therefore also emitted as
 * OpenRouter's own `reasoning` field — `effort` where the vendor takes a
 * level, `max_tokens` where it takes a budget — so a picked effort reaches the
 * vendor instead of being silently discarded.
 */
export function chatProviderOptions(
  model: ResolvedModel,
  effort: unknown,
): NonNullable<AgentExecutionOptions['providerOptions']> {
  const level = EFFORT_LEVELS.find((candidate) => candidate === effort);
  const vendor = model.provider === 'vertex' ? 'google' : vendorOf(model.id);
  const name = modelNameOf(model.id);
  if (vendor !== 'google') {
    const options = level ? { [vendor]: { reasoningEffort: level } } : {};
    return model.provider === 'openrouter' && level
      ? { ...options, openrouter: { reasoning: { effort: level } } }
      : options;
  }
  const thinkingConfig: {
    includeThoughts: boolean;
    thinkingLevel?: ChatEffortLevel;
    thinkingBudget?: number;
  } = { includeThoughts: true };
  let routed:
    | { reasoning: { effort: ChatEffortLevel } }
    | { reasoning: { max_tokens: number } }
    | undefined;
  if (level && /^gemini-3/.test(name)) {
    thinkingConfig.thinkingLevel = level;
    routed = { reasoning: { effort: level } };
  } else if (level) {
    thinkingConfig.thinkingBudget = GEMINI_THINKING_BUDGETS[level];
    routed = { reasoning: { max_tokens: GEMINI_THINKING_BUDGETS[level] } };
  }
  return model.provider === 'openrouter' && routed
    ? { google: { thinkingConfig }, openrouter: routed }
    : { google: { thinkingConfig } };
}

/** Provider options for a role, from what the CopilotKit route put into the request context. */
export function chatProviderOptionsFor(
  requestContext: Pick<RequestContext, 'get'>,
  role: ModelRole = 'chat',
) {
  return chatProviderOptions(
    resolvedModelForRole(role, requestContext),
    requestContext.get(CHAT_EFFORT_KEY),
  );
}

/** Prompt length above which auto mode picks Intelligent. */
export const AUTO_LONG_PROMPT_CHARS = 1_200;

/** Prompt length below which auto mode may pick Velocity. */
export const AUTO_SHORT_PROMPT_CHARS = 120;

/** What the auto heuristic reads: the run's first user message and the thread's state. */
export interface AutoModeSignals {
  prompt: string;
  /** The previous turn of the thread ended in a tool error. */
  previousTurnFailed?: boolean;
  /** The thread has already made an ingestion tool call. */
  usedIngestionTool?: boolean;
}

const COMPARISON_WORDS =
  /(compare|comparar|comparaç|comparac|comparison|versus|\bvs\b)/i;

/** Separators a list of vehicles is written with, in English and Portuguese. */
const LIST_SEPARATORS = /,|\se\s|\sand\s|\sversus\s|\svs\s|\sx\s|\//gi;

/**
 * Whether the prompt compares more than two vehicles. Without a classifier
 * this is approximated structurally: a comparison verb plus at least two list
 * separators, because naming three vehicles takes two separators.
 */
export function comparesManyVehicles(prompt: string): boolean {
  if (!COMPARISON_WORDS.test(prompt)) {
    return false;
  }
  return (prompt.match(LIST_SEPARATORS) ?? []).length >= 2;
}

/**
 * The mode `auto` runs in. Heuristic only in this release: no classifier model
 * call, so the decision costs nothing and cannot itself run the wallet dry.
 * It is made once, from the first user message of the run and the thread
 * state, and pinned for the whole run.
 */
export function resolveAutoMode(signals: AutoModeSignals): ResolvedChatMode {
  const prompt = signals.prompt.trim();
  if (
    prompt.length > AUTO_LONG_PROMPT_CHARS ||
    comparesManyVehicles(prompt) ||
    signals.previousTurnFailed === true
  ) {
    return 'intelligent';
  }
  if (prompt.length < AUTO_SHORT_PROMPT_CHARS && !signals.usedIngestionTool) {
    return 'velocity';
  }
  return DEFAULT_MODE_ID;
}

function listOf(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** "google/gemini-3.8-flash" → "google". */
export function vendorOf(id: string): string {
  const slash = id.indexOf('/');
  return slash === -1 ? '' : id.slice(0, slash);
}

/** "google/gemini-3.8-flash" → "gemini-3.5-flash". */
export function modelNameOf(id: string): string {
  const slash = id.lastIndexOf('/');
  return slash === -1 ? id : id.slice(slash + 1);
}

/**
 * "google/gemini-3.8-flash" → "Gemini 3.5 Flash", "openai/gpt-5.6-luna" →
 * "GPT 5.6 Luna", "low" → "Low". The vendor prefix is dropped: the catalog
 * carries it in its own field.
 */
export function labelOf(id: string): string {
  return modelNameOf(id)
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
