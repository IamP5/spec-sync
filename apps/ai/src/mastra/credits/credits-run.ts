import type { RequestContext } from '@mastra/core/request-context';
import type { ContextWithMastra } from '@mastra/core/server';

import { requestedRun } from '../chat-model-route';
import { verifiedUserOf } from '../identity';
import {
  labelOf,
  modeLabelOf,
  type ModelRole,
  modesOfModel,
  type ResolvedChatMode,
  resolvedModelForRole,
} from '../models';
import {
  creditsEnabled,
  finishRun,
  type InsufficientCredits,
  openRun,
  reportUsage,
  type RunStatus,
} from './credits-client';
import { normaliseUsage } from './usage';

/**
 * Request context key under which the CopilotKit route stores the run's
 * `CreditsRun`. The chat agent's model resolver, `stopWhen`, `onStepFinish`
 * and `onFinish` read it from there, and so do the tools that run their own
 * sub-agent (their execute context carries the same request context).
 */
export const CREDITS_RUN_KEY = 'credits-run';

/** Error code the browser parses off the leading token of a RUN_ERROR message. */
export const INSUFFICIENT_CREDITS_CODE = 'INSUFFICIENT_CREDITS';

/** Error code for a wallet the AI service could not reach (fail closed). */
export const CREDITS_UNAVAILABLE_CODE = 'CREDITS_UNAVAILABLE';

const UNAVAILABLE_TEXT =
  'The credits service is unavailable. Try again in a moment.';

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * Integer micro-credits (`1 credit = 1_000_000`) as the UI shows them, with
 * the same rules as `formatCredits` in apps/web so a rejection message and the
 * balance pill never disagree about the same number.
 */
export function formatCredits(micro: number): string {
  const credits = micro / 1_000_000;
  if (credits <= 0) {
    return '0';
  }
  if (credits < 0.01) {
    return 'less than 0.01';
  }
  return credits < 1 ? credits.toFixed(2) : grouped.format(Math.floor(credits));
}

/**
 * Everything one chat run owes the wallet: admission before the first model
 * call, one charge per agent step, and a single close.
 *
 * The object lives for exactly one HTTP request. Each of its three operations
 * is idempotent, because the Mastra loop calls into it from several places:
 * the model resolver runs once per step but must admit only once, `stopWhen`
 * and `onStepFinish` both see the same step, and a run can end through either
 * `onFinish` or a stop.
 *
 * Failures after admission are swallowed: a settlement that cannot be written
 * must never abort a generation the user is already reading, and never make
 * the loop repeat a step. The wallet's hold expires on its own.
 */
export class CreditsRun {
  #exhausted = false;
  #admission: Promise<void> | undefined;
  #admitted: { provider: string; modelId: string } | undefined;
  #steps = new Map<string, Promise<void>>();
  #stepCount = 0;
  #toolCount = 0;
  #finish: Promise<void> | undefined;

  constructor(
    readonly uid: string,
    readonly runId: string,
    readonly threadId: string | undefined,
    private readonly log: (message: string) => void = () => undefined,
  ) {}

  /** True once the wallet reported no available credit left. */
  get exhausted(): boolean {
    return this.#exhausted;
  }

  /** True once at least one step was charged (or is being charged). */
  get charged(): boolean {
    return this.#steps.size > 0;
  }

  /**
   * Opens the run on the wallet, once per request. Rejects before the first
   * model call when the balance does not cover a minimum useful answer, or
   * when the wallet cannot be reached. The message format is the contract with
   * apps/web, which reads the leading code token off the AG-UI RUN_ERROR.
   */
  admit(
    provider: string,
    modelId: string,
    mode: ResolvedChatMode = 'normal',
  ): Promise<void> {
    this.#admission ??= this.#admit(provider, modelId, mode);
    return this.#admission;
  }

  async #admit(
    provider: string,
    modelId: string,
    mode: ResolvedChatMode,
  ): Promise<void> {
    const result = await openRun(this.uid, {
      runId: this.runId,
      provider,
      modelId,
      threadId: this.threadId,
    });
    if (result.status === 'INSUFFICIENT_CREDITS') {
      throw new Error(
        `${INSUFFICIENT_CREDITS_CODE}: ${insufficientText(result, mode)}`,
      );
    }
    if (result.status === 'UNAVAILABLE') {
      this.log(`credits admission unavailable: ${result.message}`);
      throw new Error(`${CREDITS_UNAVAILABLE_CODE}: ${UNAVAILABLE_TEXT}`);
    }
    this.#admitted = { provider, modelId };
    this.#exhausted = result.value.exhausted;
  }

  /**
   * Key of one agent step, derived from the step itself so that `stopWhen`
   * and `onStepFinish` always agree on it: Mastra hands both hooks the same
   * step object, and its `response.id` is assigned once per model call
   * (verified against @mastra/core 1.64). Deriving the key from a per-hook
   * counter instead would let a skipped callback shift the numbering and
   * charge one step's usage under a key another step already paid.
   *
   * A step without an id falls back to a per-run counter, which keeps the key
   * unique inside the run even though the two hooks can then no longer share
   * it (the charge stays idempotent per key on the wallet either way).
   */
  stepKey(step: unknown): string {
    const id = stepResponseId(step);
    return id ? `step-${id}` : `step-${++this.#stepCount}`;
  }

  /** Key of the next model call a tool made inside this run. */
  toolStepKey(toolName: string): string {
    return `tool-${toolName}-${++this.#toolCount}`;
  }

  /**
   * Charges one step, at most once per key. Callers may race on the same key:
   * the first one starts the request, the others await it, which is what lets
   * `stopWhen` block on a charge `onStepFinish` may already have started.
   */
  recordStep(
    stepKey: string,
    usage: unknown,
    model?: ChargedModel,
  ): Promise<void> {
    const pending = this.#steps.get(stepKey);
    if (pending) {
      return pending;
    }
    const started = this.#recordStep(stepKey, usage, model);
    this.#steps.set(stepKey, started);
    return started;
  }

  async #recordStep(
    stepKey: string,
    usage: unknown,
    charged?: ChargedModel,
  ): Promise<void> {
    const model = charged ?? this.#admitted;
    if (!this.#admitted || !model) {
      return;
    }
    const result = await reportUsage(this.uid, this.runId, {
      stepKey,
      provider: model.provider,
      modelId: model.modelId,
      ...normaliseUsage(usage),
    });
    if (result.status !== 'OK') {
      // A lost charge must not stop a generation the user is reading.
      this.log(`credits usage for ${stepKey} was not charged`);
      return;
    }
    this.#exhausted = result.value.exhausted;
  }

  /**
   * Closes the run on the wallet, once, after every charge this run started
   * has settled. `onStepFinish` runs detached, so the last step's charge is
   * usually still in flight when the loop finishes; the API answers `409` for
   * usage on a closed run, so finishing first would drop that charge.
   */
  finish(status: RunStatus): Promise<void> {
    this.#finish ??= this.#finishRun(status);
    return this.#finish;
  }

  async #finishRun(status: RunStatus): Promise<void> {
    if (!this.#admitted) {
      return;
    }
    await this.#settleSteps();
    const result = await finishRun(this.uid, this.runId, status);
    if (result.status !== 'OK') {
      this.log(`credits run ${this.runId} was not closed`);
      return;
    }
    this.#exhausted = result.value.exhausted;
  }

  /**
   * Waits for every charge started so far, including the ones a step or a
   * tool added while an earlier batch was still settling. Charges never
   * reject, but a settled wait keeps a future one from skipping the close.
   */
  async #settleSteps(): Promise<void> {
    const settled = new Set<Promise<void>>();
    for (;;) {
      const pending = [...this.#steps.values()].filter(
        (step) => !settled.has(step),
      );
      if (pending.length === 0) {
        return;
      }
      for (const step of pending) {
        settled.add(step);
      }
      await Promise.allSettled(pending);
    }
  }
}

/** The model a single charge is priced at, when it is not the run's own. */
export interface ChargedModel {
  provider: string;
  modelId: string;
}

/**
 * Identity Mastra gives a finished step. Both `stopWhen` and `onStepFinish`
 * see the same object, so the id is the step key both can derive.
 */
function stepResponseId(step: unknown): string | undefined {
  const id = (step as { response?: { id?: unknown } } | undefined)?.response
    ?.id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/**
 * The rejection the browser shows. It is denominated in credits and named by
 * mode, because a mode is what the user picked: the cheaper models the wallet
 * reports are mapped back to the modes they belong to, and a model that
 * belongs to no mode — an advanced per-role override — is reported by its own
 * label instead.
 */
function insufficientText(
  result: InsufficientCredits,
  mode: ResolvedChatMode,
): string {
  const names = new Set<string>();
  for (const id of result.cheaperModels) {
    const modes = modesOfModel(id).filter((candidate) => candidate !== mode);
    if (modes.length) {
      for (const candidate of modes) {
        names.add(`${modeLabelOf(candidate)} mode`);
      }
    } else {
      names.add(labelOf(id));
    }
  }
  const cheaper = [...names].join(', ');
  return (
    `Your AI credits (${formatCredits(result.available)}) do not cover a reply in ` +
    `${modeLabelOf(mode)} mode. ` +
    (cheaper
      ? `${cheaper} fits your remaining credits.`
      : 'No cheaper mode fits your remaining credits.')
  );
}

/** The run's `CreditsRun`, or undefined when credits are off or the run is anonymous. */
export function creditsRunOf(
  requestContext: Pick<RequestContext, 'get'> | undefined,
): CreditsRun | undefined {
  const run = requestContext?.get(CREDITS_RUN_KEY);
  return run instanceof CreditsRun ? run : undefined;
}

/**
 * Charges a model call a tool made inside a chat run, under its own step key
 * and at the tariff of the model its **role** resolves to for this request:
 * a PDF transcription inside a preview is charged at the `vision` tariff, its
 * identification at the `identification` one and source discovery at the
 * Vertex `discovery` one. Charging a single hardcoded pair, as this did
 * before roles existed, priced every tool call as if it had run on the chat
 * model of the operating budget.
 *
 * A no-op outside a metered run, and when the sub-agent reported no usage:
 * unlike an agent step, a tool call is not estimated, because Google Search
 * grounding calls are absorbed rather than billed to the user.
 */
export function recordToolUsage(
  requestContext: Pick<RequestContext, 'get'> | undefined,
  toolName: string,
  role: ModelRole,
  usage: unknown,
): void {
  const run = creditsRunOf(requestContext);
  if (!run || usage === undefined || usage === null) {
    return;
  }
  const { provider, id } = resolvedModelForRole(role, requestContext);
  void run.recordStep(run.toolStepKey(toolName), usage, {
    provider,
    modelId: id,
  });
}

/**
 * `setContext` hook of the CopilotKit route, registered after
 * `setChatIdentityContext`: with credits enabled it puts one `CreditsRun` for
 * the verified user into the request context. Nothing is written when credits
 * are disabled, so the run behaves exactly as before.
 */
export async function setChatCreditsContext(
  c: ContextWithMastra,
  requestContext: RequestContext,
): Promise<void> {
  if (!creditsEnabled()) {
    return;
  }
  const user = await verifiedUserOf(c.req.raw.headers);
  if (!user) {
    return;
  }
  const { runId, threadId } = await requestedRun(c.req.raw);
  requestContext.set(
    CREDITS_RUN_KEY,
    new CreditsRun(
      user.uid,
      runId ?? crypto.randomUUID(),
      threadId,
      (message) => c.get('mastra')?.getLogger()?.warn(message),
    ),
  );
}
