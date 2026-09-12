/**
 * Token usage of one model call, flattened into the body the wallet API
 * charges (`POST /wallets/{uid}/runs/{runId}/usage`).
 *
 * The AI SDK v6 / Mastra step and finish objects report usage as
 * `{ inputTokens, outputTokens, totalTokens, reasoningTokens,
 * cachedInputTokens, raw: { … } }`, but providers omit fields and some carry
 * their counts only in nested detail objects. The normaliser below is
 * deliberately tolerant: it takes the first finite number it finds for each
 * position, top level before any nested record.
 *
 * The wallet prices `inputTokens` (less `cachedInputTokens`) and
 * `outputTokens`; `reasoningTokens` is recorded only. Every token the
 * provider bills therefore has to land in one of the first two, which the
 * normaliser makes sure of in two places:
 *
 * - Reasoning. Both providers this service uses already count it inside
 *   `outputTokens` (OpenRouter's `completion_tokens`, and `@ai-sdk/google`
 *   adds `thoughtsTokenCount` to the candidates; both verified 2026-09-11).
 *   A provider that reports it separately is recognised by its own wire
 *   total — `total_tokens` / `totalTokenCount`, which Mastra keeps under
 *   `raw` — exceeding input plus output by the reasoning count, and the
 *   reasoning is then added to the output.
 * - Grounding. Gemini bills the prompt tokens of a Google Search call as
 *   `toolUsePromptTokenCount`, next to and not inside `promptTokenCount`, and
 *   the AI SDK never reads that field. It is added to the input.
 */
export interface StepUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  estimated: boolean;
}

/** Assumed prompt size when a provider reports no usage at all. */
export const ESTIMATED_INPUT_TOKENS = 8_000;

/** Assumed answer size when a provider reports no usage at all. */
export const ESTIMATED_OUTPUT_TOKENS = 2_000;

const INPUT_KEYS = ['inputTokens', 'promptTokens', 'input_tokens'];
const OUTPUT_KEYS = ['outputTokens', 'completionTokens', 'output_tokens'];
const REASONING_KEYS = [
  'reasoningTokens',
  'reasoning_tokens',
  'thoughtsTokenCount',
];
const CACHED_KEYS = [
  'cachedInputTokens',
  'cachedPromptTokens',
  'cachedTokens',
  'cached_input_tokens',
  'cachedContentTokenCount',
];
/** Gemini's grounding prompt tokens, billed as input but reported apart from it. */
const TOOL_USE_INPUT_KEYS = ['toolUsePromptTokenCount'];
/**
 * The total the provider itself reported. Not `totalTokens`: Mastra recomputes
 * that one as input + output, so it can never reveal an excluded count.
 */
const WIRE_TOTAL_KEYS = ['total_tokens', 'totalTokenCount'];

/** How deep nested detail objects are searched (`raw`, `*Details`, …). */
const MAX_DEPTH = 3;

/**
 * Flattens whatever a provider reported into the wallet API's usage body.
 * Usage that carries neither an input nor an output count is replaced by the
 * documented estimate and marked `estimated`, so a run is still charged when
 * a provider stays silent.
 */
export function normaliseUsage(usage: unknown): StepUsage {
  if (isStepUsage(usage)) {
    // Already flattened, by `sumUsage` for instance: keep its `estimated`
    // flag instead of recomputing it from the summed counts.
    return usage;
  }
  const input = pick(usage, INPUT_KEYS, 0);
  const output = pick(usage, OUTPUT_KEYS, 0);
  if (input === undefined && output === undefined) {
    return {
      inputTokens: ESTIMATED_INPUT_TOKENS,
      cachedInputTokens: 0,
      outputTokens: ESTIMATED_OUTPUT_TOKENS,
      reasoningTokens: 0,
      estimated: true,
    };
  }
  const promptTokens = input ?? 0;
  const inputTokens = promptTokens + (pick(usage, TOOL_USE_INPUT_KEYS, 0) ?? 0);
  const reasoningTokens = pick(usage, REASONING_KEYS, 0) ?? 0;
  return {
    inputTokens,
    // The API charges the uncached remainder, so a cached count above the
    // prompt itself would make the charge negative.
    cachedInputTokens: Math.min(pick(usage, CACHED_KEYS, 0) ?? 0, promptTokens),
    outputTokens:
      (output ?? 0) +
      (reasoningExcludedFromOutput(
        usage,
        inputTokens,
        output ?? 0,
        reasoningTokens,
      )
        ? reasoningTokens
        : 0),
    reasoningTokens,
    estimated: false,
  };
}

/**
 * Whether the provider left its reasoning tokens out of the output count. A
 * provider that reports a total of its own gives it away: the total then
 * covers input, output and reasoning, while the two counts alone fall short by
 * exactly the reasoning. Without a wire total the output is trusted as is.
 */
function reasoningExcludedFromOutput(
  usage: unknown,
  inputTokens: number,
  outputTokens: number,
  reasoningTokens: number,
): boolean {
  if (reasoningTokens === 0) {
    return false;
  }
  const total = pick(usage, WIRE_TOTAL_KEYS, 0);
  return (
    total !== undefined && total >= inputTokens + outputTokens + reasoningTokens
  );
}

function pick(
  value: unknown,
  keys: string[],
  depth: number,
): number | undefined {
  if (!isRecord(value) || depth > MAX_DEPTH) {
    return undefined;
  }
  for (const key of keys) {
    const count = countOf(value[key]);
    if (count !== undefined) {
      return count;
    }
  }
  for (const nested of Object.values(value)) {
    const count = pick(nested, keys, depth + 1);
    if (count !== undefined) {
      return count;
    }
  }
  return undefined;
}

function countOf(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.floor(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStepUsage(value: unknown): value is StepUsage {
  return (
    isRecord(value) &&
    typeof value['estimated'] === 'boolean' &&
    typeof value['inputTokens'] === 'number' &&
    typeof value['outputTokens'] === 'number'
  );
}

/**
 * One charge for a tool that made several model calls, such as the batched
 * PDF transcription behind `previewVehicleSource`. Every call is normalised on
 * its own, so a batch whose provider stayed silent contributes the documented
 * estimate rather than nothing, and the totals are charged under a single step
 * key instead of one wallet request per batch.
 */
export function sumUsage(usages: readonly unknown[]): StepUsage | undefined {
  if (usages.length === 0) {
    return undefined;
  }
  return usages.map(normaliseUsage).reduce((total, usage) => ({
    inputTokens: total.inputTokens + usage.inputTokens,
    cachedInputTokens: total.cachedInputTokens + usage.cachedInputTokens,
    outputTokens: total.outputTokens + usage.outputTokens,
    reasoningTokens: total.reasoningTokens + usage.reasoningTokens,
    estimated: total.estimated || usage.estimated,
  }));
}
