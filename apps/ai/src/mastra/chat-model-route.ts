import type { RequestContext } from '@mastra/core/request-context';
import { type ContextWithMastra, registerApiRoute } from '@mastra/core/server';

import {
  activeTariffs,
  creditsEnabled,
  type ModelTariff,
} from './credits/credits-client';
import { CHAT_LOCALE_KEY } from './language';
import {
  type AutoModeSignals,
  CHAT_EFFORT_KEY,
  CHAT_MODE_KEY,
  CHAT_RESOLVED_MODE_KEY,
  CHAT_ROLE_MODELS_KEY,
  chatEfforts,
  type ChatMode,
  chatModelIds,
  chatModelOfMode,
  type ChatModelOption,
  chatModels,
  chatModes,
  chatRoles,
  DEFAULT_EFFORT_ID,
  DEFAULT_MODE_ID,
  isChatMode,
  resolveAutoMode,
  type ResolvedChatMode,
} from './models';

/**
 * Path of the model catalog route. The web app reaches it as
 * `/ai/chat/models` (nginx and `apps/web/proxy.conf.json` strip the `/ai`
 * prefix). Rename only together with `ChatModelClient` in apps/web.
 */
export const CHAT_MODELS_PATH = '/chat/models';

/**
 * Key of the CopilotKit `properties` (sent as AG-UI `forwardedProps`) that
 * carries the mode the user picked. Part of the contract with
 * `ChatAgentClient` in apps/web.
 */
export const CHAT_MODE_PROPERTY = 'mode';

/** Key of the CopilotKit property that carries the advanced per-role overrides. */
export const CHAT_ROLE_MODELS_PROPERTY = 'roleModels';

/**
 * Key of the CopilotKit property that carried the single picked model before
 * modes existed. Kept for one release as a synonym for a `chat` role
 * override, so a browser that has not reloaded yet keeps running.
 */
export const CHAT_MODEL_PROPERTY = 'model';

/** Key of the CopilotKit property that carries the picked reasoning effort. */
export const CHAT_EFFORT_PROPERTY = 'effort';

/**
 * Key of the CopilotKit property that carries the language the browser is
 * running in, as a BCP 47 tag. The agent answers in it; an unknown tag is
 * ignored (see `language.ts`).
 */
export const CHAT_LOCALE_PROPERTY = 'locale';

/** The reference turn every mode estimate is priced on: uncached input tokens. */
export const REFERENCE_INPUT_TOKENS = 8_000;

/** The reference turn every mode estimate is priced on: output tokens. */
export const REFERENCE_OUTPUT_TOKENS = 1_500;

/**
 * What the browser asked for with a run. The mode, role and effort ids are
 * validated by `models.ts`; `runId` and `threadId` are the AG-UI identifiers
 * of the run, which the credits module bills against.
 */
export interface RequestedRun {
  mode?: string;
  roleModels?: Record<string, string>;
  model?: string;
  effort?: string;
  /** BCP 47 tag of the interface the run was started from. */
  locale?: string;
  runId?: string;
  threadId?: string;
  /** Signals the auto heuristic reads off the run's messages. */
  signals?: AutoModeSignals;
}

/** One mode as the picker renders it. */
export interface ChatModeView {
  id: ChatMode;
  label: string;
  description: string;
  chatModelId: string | null;
  estimatedCredits: number | null;
  relativeCost: number | null;
  affordable: boolean | null;
}

/**
 * Lists the modes the chat can run in with their cost impact, the roles the
 * advanced selector may override, the models it may offer and the reasoning
 * efforts. The route stays unauthenticated, so it cannot know a balance:
 * `affordable` is always `null` here and the browser computes it from the
 * wallet it already holds.
 */
export const chatModelRoutes = [
  registerApiRoute(CHAT_MODELS_PATH, {
    method: 'GET',
    handler: async (c) =>
      c.json(
        await chatCatalog((message) =>
          c.get('mastra')?.getLogger()?.warn(message),
        ),
      ),
  }),
];

export async function chatCatalog(
  log: (message: string) => void = () => undefined,
) {
  // With credits off nothing can be unaffordable, so the tariff list is not
  // even read: the whole catalog is offered, without estimates.
  const priced = creditsEnabled()
    ? pricedIndex(await activeTariffs())
    : undefined;
  const ids = chatModelIds().filter((id) => isPriced(priced, id));
  return {
    defaultModeId: DEFAULT_MODE_ID,
    // Auto resolves per run, not per catalog read; the browser learns the
    // resolved mode from the run itself.
    resolvedMode: null,
    modes: offeredModes(priced, log),
    roles: chatRoles(ids),
    models: offeredChatModels(ids),
    defaultEffortId: DEFAULT_EFFORT_ID,
    efforts: chatEfforts(),
  };
}

/** The advanced catalog, already reduced to the models the wallet can price. */
export function offeredChatModels(
  ids: string[] = chatModelIds(),
): ChatModelOption[] {
  const offered = new Set(ids);
  return chatModels().filter((model) => offered.has(model.id));
}

/**
 * The modes the browser may pick, each with the cost of a reference turn on
 * its `chat` model. A mode whose model has no active tariff cannot be charged
 * and is not offered — except `normal`, which must always be offerable and
 * falls back to the cheapest priced model.
 */
function offeredModes(
  priced: Map<string, ModelTariff> | undefined,
  log: (message: string) => void,
): ChatModeView[] {
  const modelOf = (mode: ResolvedChatMode) => {
    const named = chatModelOfMode(mode);
    if (mode !== DEFAULT_MODE_ID || isPriced(priced, named)) {
      return named;
    }
    const fallback = pricedOrCheapest(priced, named) ?? named;
    log(
      `${named} has no active tariff; ${DEFAULT_MODE_ID} mode falls back to ${fallback}`,
    );
    return fallback;
  };
  const normalCost = referenceTurnCost(priced, modelOf(DEFAULT_MODE_ID));
  return chatModes().flatMap((mode): ChatModeView[] => {
    if (mode.id === 'auto') {
      return [
        {
          ...mode,
          chatModelId: null,
          estimatedCredits: null,
          relativeCost: null,
          affordable: null,
        },
      ];
    }
    const id = modelOf(mode.id);
    if (mode.id !== DEFAULT_MODE_ID && !isPriced(priced, id)) {
      return [];
    }
    const estimatedCredits = referenceTurnCost(priced, id);
    return [
      {
        ...mode,
        chatModelId: id,
        estimatedCredits,
        relativeCost:
          estimatedCredits === null || !normalCost
            ? null
            : Math.round((estimatedCredits / normalCost) * 10) / 10,
        affordable: null,
      },
    ];
  });
}

/**
 * Cost of the reference turn in micro-credits, from the live tariff. `null`
 * when no tariff list could be read at all, which is also when credits are
 * disabled: the picker then shows no estimates rather than invented ones.
 */
export function referenceTurnCost(
  priced: Map<string, ModelTariff> | undefined,
  id: string,
): number | null {
  const tariff = priced?.get(`openrouter/${id}`);
  if (!tariff) {
    return null;
  }
  return Math.round(
    (tariff.inputPerMillion * REFERENCE_INPUT_TOKENS +
      tariff.outputPerMillion * REFERENCE_OUTPUT_TOKENS) /
      1_000_000,
  );
}

function pricedIndex(
  tariffs: ModelTariff[] | undefined,
): Map<string, ModelTariff> | undefined {
  if (!tariffs) {
    return undefined;
  }
  return new Map(
    tariffs.map((tariff) => [`${tariff.provider}/${tariff.modelId}`, tariff]),
  );
}

function isPriced(
  priced: Map<string, ModelTariff> | undefined,
  id: string,
): boolean {
  return !priced || priced.has(`openrouter/${id}`);
}

/**
 * `id` when it is priced, otherwise the cheapest priced OpenRouter model of the
 * catalog. Only `normal` uses this: the default mode must stay offerable even
 * when its own model lost its tariff.
 */
function pricedOrCheapest(
  priced: Map<string, ModelTariff> | undefined,
  id: string,
): string | undefined {
  if (isPriced(priced, id)) {
    return id;
  }
  const cheapest = [...(priced?.entries() ?? [])]
    .filter(([key]) => key.startsWith('openrouter/'))
    .sort(
      (a, b) =>
        a[1].inputPerMillion +
        a[1].outputPerMillion -
        (b[1].inputPerMillion + b[1].outputPerMillion),
    )[0];
  return cheapest?.[1].modelId;
}

/**
 * `setContext` hook of the CopilotKit route: reads the mode, the advanced role
 * overrides, the reasoning effort and the interface language the browser asked
 * for and stores them in the request context, where every role resolution
 * picks them up (`modelForRole`, `chatProviderOptionsFor`) and where the agent
 * reads the language (`languageInstruction`).
 *
 * Auto is resolved here, before the agent's model resolver runs, so the
 * routing decision is made once and is already pinned when the run is admitted
 * against the wallet.
 *
 * CopilotKit posts a JSON envelope `{ method, body }` to the runtime route in
 * single-route mode; for `agent/run` the body is the AG-UI `RunAgentInput`
 * whose `forwardedProps` hold the client's `properties`. The body is read
 * from a clone, the runtime still parses the original. Anything unexpected
 * is ignored: the agent then runs in the default mode.
 */
export async function setChatModelContext(
  c: ContextWithMastra,
  requestContext: RequestContext,
): Promise<void> {
  const { mode, roleModels, model, effort, locale, signals } =
    await requestedRun(c.req.raw);
  if (effort) {
    requestContext.set(CHAT_EFFORT_KEY, effort);
  }
  if (locale) {
    requestContext.set(CHAT_LOCALE_KEY, locale);
  }
  const overrides = { ...roleModels };
  // One release of compatibility: a browser that only knows `model` meant a
  // chat model, which is now the `chat` role's override.
  if (model && overrides['chat'] === undefined) {
    overrides['chat'] = model;
  }
  if (Object.keys(overrides).length) {
    requestContext.set(CHAT_ROLE_MODELS_KEY, overrides);
  }
  const asked: ChatMode = isChatMode(mode) ? mode : DEFAULT_MODE_ID;
  requestContext.set(CHAT_MODE_KEY, asked);
  requestContext.set(
    CHAT_RESOLVED_MODE_KEY,
    asked === 'auto'
      ? resolveAutoMode(signals ?? { prompt: '' })
      : (asked satisfies ResolvedChatMode),
  );
}

export async function requestedRun(request: Request): Promise<RequestedRun> {
  if (request.method !== 'POST') {
    return {};
  }
  try {
    const envelope: unknown = await request.clone().json();
    if (!isRecord(envelope) || envelope['method'] !== 'agent/run') {
      return {};
    }
    const body = envelope['body'];
    const props = isRecord(body) ? body['forwardedProps'] : undefined;
    return {
      mode: stringProperty(props, CHAT_MODE_PROPERTY),
      roleModels: roleModelsOf(props),
      model: stringProperty(props, CHAT_MODEL_PROPERTY),
      effort: stringProperty(props, CHAT_EFFORT_PROPERTY),
      locale: stringProperty(props, CHAT_LOCALE_PROPERTY),
      runId: stringProperty(body, 'runId'),
      threadId: stringProperty(body, 'threadId'),
      signals: autoModeSignals(body),
    };
  } catch {
    // Not JSON, or the body was already consumed: no preferences.
    return {};
  }
}

/** Ingestion tool names whose presence in a thread rules Velocity out. */
const INGESTION_TOOLS = [
  'discoverVehicleSpecificationSources',
  'previewVehicleSource',
  'prepareVehicleIngestion',
  'startVehicleIngestion',
];

/**
 * What the auto heuristic reads off the AG-UI run: the last user message is
 * the prompt of this turn, and the messages before it carry the thread state
 * the browser replayed — whether an ingestion tool ran, and whether the
 * previous turn ended in a tool error.
 */
export function autoModeSignals(body: unknown): AutoModeSignals {
  const messages = isRecord(body) ? body['messages'] : undefined;
  if (!Array.isArray(messages)) {
    return { prompt: '' };
  }
  const last = [...messages]
    .reverse()
    .find((message) => isRecord(message) && message['role'] === 'user');
  const results = messages.filter(
    (message) => isRecord(message) && message['role'] === 'tool',
  );
  return {
    prompt: textOf(isRecord(last) ? last['content'] : undefined),
    usedIngestionTool: messages.some(
      (message) =>
        isRecord(message) &&
        typeof message['toolName'] === 'string' &&
        INGESTION_TOOLS.includes(message['toolName']),
    ),
    previousTurnFailed: isToolError(results.at(-1)),
  };
}

/** A tool result the agent saw as a failure, however the client shaped it. */
function isToolError(message: unknown): boolean {
  if (!isRecord(message)) {
    return false;
  }
  if (message['error'] === true || message['isError'] === true) {
    return true;
  }
  return /"status"\s*:\s*"(ERROR|FAILED)"/.test(textOf(message['content']));
}

function textOf(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((part) =>
      isRecord(part) && typeof part['text'] === 'string' ? part['text'] : '',
    )
    .join('\n');
}

function roleModelsOf(props: unknown): Record<string, string> | undefined {
  const value = isRecord(props) ? props[CHAT_ROLE_MODELS_PROPERTY] : undefined;
  if (!isRecord(value)) {
    return undefined;
  }
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && entry[1].length > 0,
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function stringProperty(props: unknown, key: string): string | undefined {
  const value = isRecord(props) ? props[key] : undefined;
  return typeof value === 'string' && value ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
