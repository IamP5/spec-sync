import { describe, expect, it } from 'vitest';

import {
  ESTIMATED_INPUT_TOKENS,
  ESTIMATED_OUTPUT_TOKENS,
  normaliseUsage,
  sumUsage,
} from './usage';

describe('usage normalisation', () => {
  it('reads the flat AI SDK v6 shape Mastra reports on a step', () => {
    // Captured from a real Mastra 1.64 onStepFinish with a mock model.
    expect(
      normaliseUsage({
        inputTokens: 5,
        outputTokens: 6,
        totalTokens: 11,
        reasoningTokens: 2,
        cachedInputTokens: 3,
        raw: { inputTokens: 5, outputTokens: 6, totalTokens: 11 },
      }),
    ).toEqual({
      inputTokens: 5,
      cachedInputTokens: 3,
      outputTokens: 6,
      reasoningTokens: 2,
      estimated: false,
    });
  });

  it('falls back to nested details and legacy names', () => {
    expect(
      normaliseUsage({
        raw: { promptTokens: 40, completionTokens: 7 },
        inputTokensDetails: { cachedTokens: 12 },
      }),
    ).toEqual({
      inputTokens: 40,
      cachedInputTokens: 12,
      outputTokens: 7,
      reasoningTokens: 0,
      estimated: false,
    });
  });

  it('estimates when the provider reported no usage at all', () => {
    for (const value of [undefined, null, {}, { totalTokens: 12 }]) {
      expect(normaliseUsage(value)).toEqual({
        inputTokens: ESTIMATED_INPUT_TOKENS,
        cachedInputTokens: 0,
        outputTokens: ESTIMATED_OUTPUT_TOKENS,
        reasoningTokens: 0,
        estimated: true,
      });
    }
  });

  it('does not estimate when only one half is missing', () => {
    expect(normaliseUsage({ outputTokens: 9 })).toEqual({
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 9,
      reasoningTokens: 0,
      estimated: false,
    });
  });

  it('keeps every count a non-negative integer within the prompt', () => {
    expect(
      normaliseUsage({
        inputTokens: 10.7,
        outputTokens: -4,
        cachedInputTokens: 99,
        reasoningTokens: Number.NaN,
      }),
    ).toEqual({
      inputTokens: 10,
      // A cached count above the prompt would make the charge negative.
      cachedInputTokens: 10,
      outputTokens: 0,
      reasoningTokens: 0,
      estimated: false,
    });
  });
});

describe('usage of a tool that made several model calls', () => {
  it('charges nothing when no model ran', () => {
    expect(sumUsage([])).toBeUndefined();
  });

  it('adds every call up into one charge', () => {
    expect(
      sumUsage([
        { inputTokens: 1_200, outputTokens: 300, cachedInputTokens: 200 },
        { inputTokens: 800, outputTokens: 150, reasoningTokens: 40 },
      ]),
    ).toEqual({
      inputTokens: 2_000,
      cachedInputTokens: 200,
      outputTokens: 450,
      reasoningTokens: 40,
      estimated: false,
    });
  });

  it('estimates each silent call rather than the batch as a whole', () => {
    expect(sumUsage([undefined, undefined])).toEqual({
      inputTokens: ESTIMATED_INPUT_TOKENS * 2,
      cachedInputTokens: 0,
      outputTokens: ESTIMATED_OUTPUT_TOKENS * 2,
      reasoningTokens: 0,
      estimated: true,
    });
  });

  it('keeps the estimated flag when a sum is normalised again', () => {
    const summed = sumUsage([undefined, { inputTokens: 10, outputTokens: 5 }]);
    expect(summed?.estimated).toBe(true);
    expect(normaliseUsage(summed)).toBe(summed);
  });
});
