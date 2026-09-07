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
  const inputTokens = input ?? 0;
  return {
    inputTokens,
    // The API charges the uncached remainder, so a cached count above the
    // prompt itself would make the charge negative.
    cachedInputTokens: Math.min(pick(usage, CACHED_KEYS, 0) ?? 0, inputTokens),
    outputTokens: output ?? 0,
    reasoningTokens: pick(usage, REASONING_KEYS, 0) ?? 0,
    estimated: false,
  };
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
