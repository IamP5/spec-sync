import { createVertex } from '@ai-sdk/google-vertex';
import type { AgentExecutionOptions } from '@mastra/core/agent';
import {
  modelSupportsAttachments,
  modelSupportsStructuredOutput,
} from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';

import { cachedTariffModelIds } from './credits/credits-client';

/** The options of one provider key, as Mastra types them. */
type ProviderOptions = NonNullable<AgentExecutionOptions['providerOptions']>;
type ProviderEntry = ProviderOptions[string];

/**
 * The one place that decides which model serves which job, and how hard it
 * thinks.
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

/**
 * The three tiers the composer offers plus `auto`. The ids are the wire
 * contract with apps/web and are kept from the first release; the labels the
 * user sees are Instant / Balanced / Deep. A tier is a map from role to model
 * and reasoning effort.
 */
export type ChatMode = 'velocity' | 'normal' | 'intelligent' | 'auto';

/** A tier that names models directly; `auto` resolves to one of these per run. */
export type ResolvedChatMode = Exclude<ChatMode, 'auto'>;

export const CHAT_MODES: readonly ChatMode[] = [
  'velocity',
  'normal',
  'intelligent',
  'auto',
];

/** Tier a run uses when the browser sends none. */
export const DEFAULT_MODE_ID: ResolvedChatMode = 'normal';

const EFFORT_LEVELS = ['low', 'medium', 'high'] as const;

export type ChatEffortLevel = (typeof EFFORT_LEVELS)[number];

/** Where a role's model actually runs. `vertex` is grounding only. */
export type ChatModelProvider = 'openrouter' | 'vertex';

/** Provider and id of the model a role resolves to; what the wallet is charged against. */
export interface ResolvedModel {
  provider: ChatModelProvider;
  id: string;
}

/** One cell of the tier table: a model and, when the tier fixes it, its reasoning effort. */
interface TierEntry extends ResolvedModel {
  effort?: ChatEffortLevel;
}

/** The roles the tier table names; `title` and `router` are configuration. */
type TierRole =
  | 'chat'
  | 'vision'
  | 'identification'
  | 'contentDiscovery'
  | 'discovery'
  | 'extraction';

function routed(id: string, effort?: ChatEffortLevel): TierEntry {
  return effort
    ? { provider: 'openrouter', id, effort }
    : { provider: 'openrouter', id };
}

function grounded(id: string, effort?: ChatEffortLevel): TierEntry {
  return effort
    ? { provider: 'vertex', id, effort }
    : { provider: 'vertex', id };
}

/**
 * Model and reasoning effort per tier and role, decided on 2026-09-11 from
 * the measured evals in `apps/ai/eval` (blind-graded chat quality, PDF
 * transcription alignment, identification recall, grounding hit rate) rather
 * than from list prices.
 *
 * - `chat`: GPT 5.6 Luna ties Sol on quality at a ninth of the cost, so the
 *   two cheaper tiers differ only in how hard Luna thinks; Deep buys Sol.
 * - `vision` and `identification` stay on Gemini 3.8 Flash in every tier: it
 *   is the one model that transcribes real brochures cleanly and identified
 *   every gold vehicle. The tier only moves how hard it thinks (low / medium
 *   / high) for both roles.
 * - `contentDiscovery` and `discovery` are Google Search grounding and run on
 *   Vertex in every tier — grounding through OpenRouter never worked (the
 *   Google tool is sent as an unknown tool type). The tier picks the Gemini
 *   generation that reads the results.
 * - `extraction` is the curator's model; only Deep asks it to think harder.
 *   Every extraction today runs without a request context and therefore at
 *   the Balanced entry (see `resolvedModelForRole`).
 */
const TIER_TABLE: Record<ResolvedChatMode, Record<TierRole, TierEntry>> = {
  velocity: {
    chat: routed('openai/gpt-5.6-luna', 'low'),
    vision: routed('google/gemini-3.8-flash', 'low'),
    identification: routed('google/gemini-3.8-flash', 'low'),
    contentDiscovery: grounded('gemini-2.5-flash'),
    discovery: grounded('gemini-2.5-flash'),
    extraction: routed('google/gemini-3.8-flash'),
  },
  normal: {
    chat: routed('openai/gpt-5.6-luna', 'high'),
    vision: routed('google/gemini-3.8-flash', 'medium'),
    identification: routed('google/gemini-3.8-flash', 'medium'),
    contentDiscovery: grounded('gemini-3.8-flash'),
    discovery: grounded('gemini-3.8-flash'),
    extraction: routed('google/gemini-3.8-flash'),
  },
  intelligent: {
    chat: routed('openai/gpt-5.6-sol', 'medium'),
    vision: routed('google/gemini-3.8-flash', 'high'),
    identification: routed('google/gemini-3.8-flash', 'high'),
    contentDiscovery: grounded('gemini-3.1-pro-preview'),
    discovery: grounded('gemini-3.1-pro-preview'),
    extraction: routed('google/gemini-3.8-flash', 'high'),
  },
};

const MODE_LABELS: Record<ChatMode, string> = {
  velocity: 'Instant',
  normal: 'Balanced',
  intelligent: 'Deep',
  auto: 'Auto',
};

const MODE_DESCRIPTIONS: Record<ChatMode, string> = {
  velocity: 'Quick answers at the lowest cost.',
  normal: 'Thorough answers for everyday questions.',
  intelligent: 'The strongest reasoning for hard comparisons.',
  auto: 'Picks a level from your message.',
};

/** Thread titles; SpecSync's own budget, never charged to the user. */
const DEFAULT_TITLE_MODEL = 'openai/gpt-5.6-luna';

/**
 * Request context key under which the CopilotKit route stores the tier the
 * browser asked for (see `chat-model-route.ts`).
 */
export const CHAT_MODE_KEY = 'chat-mode';

/**
 * Request context key under which the CopilotKit route stores the tier a run
 * actually runs in. For `auto` the heuristic decides it once, before
 * admission, and pins it here so every role of the run agrees on it.
 */
export const CHAT_RESOLVED_MODE_KEY = 'chat-resolved-mode';

/** Request context key for the advanced per-role overrides (`roleModels`). */
export const CHAT_ROLE_MODELS_KEY = 'chat-role-models';

/**
 * Request context key under which the CopilotKit route stores the reasoning
 * effort a browser of the previous release still sends. The tier now fixes
 * the effort of every role; an explicit level here overrides the `chat`
 * role's for one release and nothing else.
 */
export const CHAT_EFFORT_KEY = 'chat-effort';

/** Effort id that leaves the amount of thinking to the tier. */
export const DEFAULT_EFFORT_ID = 'auto';

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

/** One entry of the model catalog; the id is part of the contract with apps/web. */
export interface ChatModelOption {
  id: string;
  label: string;
  vendor: string;
  provider: ChatModelProvider;
}

/** One entry of the tier picker. */
export interface ChatModeOption {
  id: ChatMode;
  label: string;
  description: string;
}

/**
 * The roles the advanced selector may override. Only `chat`: the other roles
 * are pinned to the model their eval singled out, and grounding cannot leave
 * Vertex at all.
 */
export const CONFIGURABLE_ROLES = ['chat'] as const;

export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

const ROLE_LABELS: Record<ConfigurableRole, string> = {
  chat: 'Chat',
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

/** The `chat` model of a tier, which is what its cost estimate is computed on. */
export function chatModelOfMode(mode: ResolvedChatMode): string {
  return TIER_TABLE[mode].chat.id;
}

/** Tiers whose `chat` model is `id`, for the insufficient-credits message. */
export function modesOfModel(id: string): ResolvedChatMode[] {
  return (Object.keys(TIER_TABLE) as ResolvedChatMode[]).filter(
    (mode) => TIER_TABLE[mode].chat.id === id,
  );
}

/**
 * Models the advanced selector may offer. `SPECSYNC_CHAT_MODELS` (comma
 * separated OpenRouter ids) overrides the default, which is the union of the
 * models the tier table names for the configurable roles.
 */
export function chatModelIds(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = listOf(env['SPECSYNC_CHAT_MODELS']);
  if (configured.length) {
    return configured;
  }
  const ids = new Set<string>();
  for (const tier of Object.values(TIER_TABLE)) {
    for (const role of CONFIGURABLE_ROLES) {
      ids.add(tier[role].id);
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
 * capability the role needs. Both flags come from Mastra's own capability
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
 * The tier a run uses. `auto` is resolved once before admission and pinned
 * into the request context, so every role of the run reads the same decision.
 * Without a request context — the curator workflow, thread titles — a run has
 * no tier and every role falls back to the Balanced entry.
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
 * The advanced override for a role, or `undefined` when it follows the tier.
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
 * The tier cell a role resolves to for this request: model, provider and the
 * effort the tier fixes for it. `title` and `router` are configuration, not
 * tier entries; `discovery` and `extraction` keep their operator overrides
 * (`SPECSYNC_DISCOVERY_MODEL`, `SPECSYNC_EXTRACTION_MODEL`), which replace
 * the model in every tier and leave the effort alone. An advanced override
 * of `chat` likewise keeps the tier's effort.
 */
function tierEntryOf(
  role: ModelRole,
  requestContext: Pick<RequestContext, 'get'> | undefined,
  env: NodeJS.ProcessEnv,
): TierEntry {
  const tier = TIER_TABLE[modeOf(requestContext)];
  switch (role) {
    case 'title':
      return routed(env['SPECSYNC_TITLE_MODEL'] ?? DEFAULT_TITLE_MODEL);
    // The classifier-backed router is a later change; until then it costs the
    // same as a Balanced chat turn, which is what its estimates assume.
    case 'router':
      return TIER_TABLE[DEFAULT_MODE_ID].chat;
    case 'discovery':
      return withModel(tier.discovery, env['SPECSYNC_DISCOVERY_MODEL']);
    case 'extraction':
      return withModel(tier.extraction, env['SPECSYNC_EXTRACTION_MODEL']);
    default:
      return withModel(tier[role], roleOverrideOf(role, requestContext, env));
  }
}

function withModel(entry: TierEntry, id: string | undefined): TierEntry {
  return id ? { ...entry, id } : entry;
}

/**
 * Provider and id the role actually resolves to; what the wallet is charged
 * against. Called without a request context a role resolves to the Balanced
 * entry, never to a user's tier — that is what keeps the curator workflow and
 * the thread titles on SpecSync's own budget.
 */
export function resolvedModelForRole(
  role: ModelRole,
  requestContext?: Pick<RequestContext, 'get'>,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedModel {
  const { provider, id } = tierEntryOf(role, requestContext, env);
  return { provider, id };
}

/**
 * The reasoning effort a role runs with for this request, or `undefined`
 * when the tier leaves it to the provider. The tier fixes it per role; the
 * `effort` property a browser of the previous release still sends overrides
 * the `chat` role's for one release.
 */
export function effortForRole(
  role: ModelRole,
  requestContext?: Pick<RequestContext, 'get'>,
  env: NodeJS.ProcessEnv = process.env,
): ChatEffortLevel | undefined {
  if (role === 'chat') {
    const asked = requestContext?.get(CHAT_EFFORT_KEY);
    const level = EFFORT_LEVELS.find((candidate) => candidate === asked);
    if (level) {
      return level;
    }
  }
  return tierEntryOf(role, requestContext, env).effort;
}

/**
 * The model a role runs on for this request. A Vertex role returns the
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

/**
 * Reasoning efforts the composer may pick. None since the tiers fix the
 * effort per role: the browser hides its effort track when the list is
 * empty, and the `effort` property it may still send is honoured for `chat`
 * only (`effortForRole`).
 */
export function chatEfforts(): ChatEffortOption[] {
  return [];
}

/**
 * Provider options for a run of `model` with reasoning effort `effort`.
 *
 * A picked effort becomes a thinking level on Gemini 3.x, a thinking budget
 * on Gemini 2.5 and a reasoning effort on OpenAI and Anthropic
 * (docs/openrouter-model-routing.md). The chat agent additionally streams
 * Gemini's thought summaries (`thoughts`); the structured-output roles do not.
 *
 * Those vendor keys are what a direct provider instance reads, and the Vertex
 * roles are served by exactly that. A model routed through OpenRouter is not:
 * Mastra 1.64 resolves `openrouter/…` to its own OpenRouter chat model, whose
 * `doGenerate` spreads only `providerOptions.openrouter` into the request
 * body and drops every other key (verified against @mastra/core 1.64). The
 * same effort is therefore also emitted as OpenRouter's own `reasoning` field
 * — `effort` where the vendor takes a level, `max_tokens` where it takes a
 * budget — so a picked effort reaches the vendor instead of being silently
 * discarded.
 *
 * Prompt caching rides on the same key. OpenAI and Gemini cache a repeated
 * prompt prefix on their own (OpenRouter, "Prompt caching": automatic from
 * 1,024 tokens, no request field); Anthropic caches nothing unless asked, so
 * an Anthropic model gets OpenRouter's top-level `cache_control`, which places
 * the breakpoint on the last cacheable block of the prompt for us.
 */
export function chatProviderOptions(
  model: ResolvedModel,
  effort: unknown,
  { thoughts = true }: { thoughts?: boolean } = {},
): ProviderOptions {
  const level = EFFORT_LEVELS.find((candidate) => candidate === effort);
  const vendor = model.provider === 'vertex' ? 'google' : vendorOf(model.id);
  const name = modelNameOf(model.id);
  if (vendor !== 'google') {
    const options = level ? { [vendor]: { reasoningEffort: level } } : {};
    const routed: ProviderEntry = {
      ...(level ? { reasoning: { effort: level } } : {}),
      ...(vendor === 'anthropic'
        ? { cache_control: { type: 'ephemeral' } }
        : {}),
    };
    return model.provider === 'openrouter' && Object.keys(routed).length
      ? { ...options, openrouter: routed }
      : options;
  }
  const thinkingConfig: {
    includeThoughts?: boolean;
    thinkingLevel?: ChatEffortLevel;
    thinkingBudget?: number;
  } = thoughts ? { includeThoughts: true } : {};
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

/**
 * Provider options for a role of this request: the tier's model and effort
 * for it, from what the CopilotKit route put into the request context. Every
 * role that calls a model passes these, so a tier changes how hard the
 * transcriber, the identifier and the grounding reader think, not only the
 * chat agent. Without a request context the Balanced entry applies.
 */
export function chatProviderOptionsFor(
  requestContext: Pick<RequestContext, 'get'> | undefined,
  role: ModelRole = 'chat',
) {
  return chatProviderOptions(
    resolvedModelForRole(role, requestContext),
    effortForRole(role, requestContext),
    { thoughts: role === 'chat' },
  );
}

/** Prompt length above which auto picks Deep. */
export const AUTO_LONG_PROMPT_CHARS = 1_200;

/** Prompt length below which auto may pick Instant. */
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
 * The tier `auto` runs in. Heuristic only in this release: no classifier model
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

/** "google/gemini-3.8-flash" → "gemini-3.8-flash". */
export function modelNameOf(id: string): string {
  const slash = id.lastIndexOf('/');
  return slash === -1 ? id : id.slice(slash + 1);
}

/**
 * "google/gemini-3.8-flash" → "Gemini 3.8 Flash", "openai/gpt-5.6-luna" →
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
