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

  it('trusts an output count that already includes the reasoning', () => {
    // OpenRouter: completion_tokens covers the reasoning, and its total is
    // prompt + completion. Nothing to add.
    expect(
      normaliseUsage({
        inputTokens: 1_000,
        outputTokens: 700,
        totalTokens: 1_700,
        reasoningTokens: 400,
        cachedInputTokens: 0,
        raw: {
          raw: {
            prompt_tokens: 1_000,
            completion_tokens: 700,
            total_tokens: 1_700,
            completion_tokens_details: { reasoning_tokens: 400 },
          },
        },
      }),
    ).toMatchObject({
      inputTokens: 1_000,
      outputTokens: 700,
      reasoningTokens: 400,
    });
    // Gemini through the AI SDK: the candidates plus the thoughts, and a
    // total that adds up to the same. Nothing to add either.
    expect(
      normaliseUsage({
        inputTokens: 1_000,
        outputTokens: 700,
        totalTokens: 1_700,
        reasoningTokens: 400,
        raw: {
          raw: {
            promptTokenCount: 1_000,
            candidatesTokenCount: 300,
            thoughtsTokenCount: 400,
            totalTokenCount: 1_700,
          },
        },
      }),
    ).toMatchObject({
      inputTokens: 1_000,
      outputTokens: 700,
      reasoningTokens: 400,
    });
  });

  it('bills the reasoning a provider left out of its output count', () => {
    // The wire total exceeds input + output by exactly the reasoning: the
    // provider counted it apart, so the wallet would otherwise never see it.
    expect(
      normaliseUsage({
        inputTokens: 1_000,
        outputTokens: 300,
        totalTokens: 1_300,
        reasoningTokens: 400,
        raw: { raw: { total_tokens: 1_700 } },
      }),
    ).toMatchObject({
      inputTokens: 1_000,
      outputTokens: 700,
      reasoningTokens: 400,
    });
    // No wire total: the output is trusted as reported.
    expect(
      normaliseUsage({
        inputTokens: 1_000,
        outputTokens: 300,
        reasoningTokens: 400,
      }),
    ).toMatchObject({ outputTokens: 300, reasoningTokens: 400 });
  });

  it('bills the prompt tokens of a Google Search grounding call as input', () => {
    // Gemini reports them next to promptTokenCount; the AI SDK never reads
    // the field, so it only survives in the raw usage.
    expect(
      normaliseUsage({
        inputTokens: 2_000,
        outputTokens: 500,
        cachedInputTokens: 1_500,
        raw: {
          raw: {
            promptTokenCount: 2_000,
            toolUsePromptTokenCount: 6_000,
            candidatesTokenCount: 500,
            totalTokenCount: 8_500,
          },
        },
      }),
    ).toEqual({
      inputTokens: 8_000,
      // The cache covers the prompt, never the grounding tokens.
      cachedInputTokens: 1_500,
      outputTokens: 500,
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
