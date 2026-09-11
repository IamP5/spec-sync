import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { MockLanguageModelV3 } from 'ai/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

/**
 * Drives the real Mastra agent loop with a mock model to pin down the hook
 * behaviour the credits metering depends on (verified against
 * @mastra/core 1.64.0 / ai 6.0.277):
 *
 * - an async `model` resolver is awaited, runs once per step, and an error it
 *   throws leaves `agent.stream()` unwrapped;
 * - `onStepFinish`, `onFinish` and `stopWhen` supplied through `defaultOptions`
 *   all reach the loop, and `maxSteps` keeps working next to `stopWhen`;
 * - `stopWhen` is awaited and sees the finished steps, `onStepFinish` is not;
 * - `stopWhen` and `onStepFinish` see the same step object, so both derive the
 *   same `response.id` step key;
 * - `onAbort` fires when the run is cancelled mid-stream and `onError` when
 *   the loop fails, and neither is followed by `onFinish`.
 */

const openRun = vi.fn();
const reportUsage = vi.fn();
const finishRun = vi.fn();

vi.mock('../credits/credits-client', () => ({
  creditsEnabled: () => true,
  openRun: (...args: unknown[]) => openRun(...args),
  reportUsage: (...args: unknown[]) => reportUsage(...args),
  finishRun: (...args: unknown[]) => finishRun(...args),
}));

const model = new MockLanguageModelV3();

vi.mock('../models', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../models')>()),
  modelForRole: () => model,
  resolvedModelForRole: () => ({
    provider: 'openrouter',
    id: 'anthropic/claude-sonnet-5',
  }),
  modeOf: () => 'intelligent',
  chatProviderOptionsFor: () => ({ google: { thinkingConfig: {} } }),
}));

const { CREDITS_RUN_KEY, CreditsRun } = await import('../credits/credits-run');
type CreditsRun = InstanceType<typeof CreditsRun>;
const {
  chatDefaultOptions,
  chatModelWithCredits,
  MAX_CHAT_STEPS,
  specSyncAgent,
} = await import('./spec-sync-agent');

let modelCalls = 0;

/**
 * The provider stream parts of one step. Written in the flat shape the
 * runtime actually accepts and reports back through `usage`; the published
 * part types of the installed provider package disagree, so the array is
 * handed to the mock unchecked.
 */
function chunks(step: number, withToolCall: boolean) {
  return withToolCall
    ? [
        {
          type: 'tool-call' as const,
          toolCallId: `tc-${step}`,
          toolName: 'ping',
          input: '{}',
        },
        {
          type: 'finish' as const,
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: step * 10, outputTokens: step, totalTokens: 0 },
        },
      ]
    : [
        { type: 'text-start' as const, id: 't' },
        { type: 'text-delta' as const, id: 't', delta: 'done' },
        { type: 'text-end' as const, id: 't' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: step * 10, outputTokens: step, totalTokens: 0 },
        },
      ];
}

/** A model that calls `ping` for the first `toolSteps` steps, then answers. */
function scriptedModel(toolSteps: number) {
  return new MockLanguageModelV3({
    doStream: () => {
      modelCalls += 1;
      const script = chunks(modelCalls, modelCalls <= toolSteps);
      return Promise.resolve({
        stream: new ReadableStream({
          start(controller) {
            for (const chunk of script) controller.enqueue(chunk as never);
            controller.close();
          },
        }),
      } as never);
    },
  });
}

const ping = createTool({
  id: 'ping',
  description: 'ping',
  inputSchema: z.object({}),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: () => Promise.resolve({ ok: true }),
});

/** The chat agent's real hooks on a throwaway agent with a mock model. */
function agent(scripted: MockLanguageModelV3) {
  return new Agent({
    id: 'chat-under-test',
    name: 'chat under test',
    instructions: 'test',
    model: async (options) => {
      // The real resolver, with the mocked models module behind it.
      await chatModelWithCredits(options as never);
      return scripted;
    },
    defaultOptions: chatDefaultOptions as never,
    tools: { ping },
  });
}

function contextWithRun(run?: CreditsRun): RequestContext {
  const requestContext = new RequestContext();
  if (run) {
    requestContext.set(CREDITS_RUN_KEY, run);
  }
  return requestContext;
}

async function drain(a: Agent, requestContext: RequestContext) {
  const stream = await a.stream('hi', { requestContext });
  let text = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'text-delta') {
      text += String(
        (chunk as { payload?: { text?: string } }).payload?.text ?? '',
      );
    }
  }
  await stream.finishReason;
  return text;
}

function stepKeys(): string[] {
  return reportUsage.mock.calls.map(
    (call) => (call[2] as { stepKey: string }).stepKey,
  );
}

beforeEach(() => {
  modelCalls = 0;
  openRun.mockReset().mockResolvedValue({
    status: 'OK',
    value: {
      runId: 'r-1',
      hold: 1,
      balance: 1,
      available: 1,
      exhausted: false,
    },
  });
  reportUsage.mockReset().mockResolvedValue({
    status: 'OK',
    value: { charge: 1, balance: 1, available: 1, exhausted: false },
  });
  finishRun
    .mockReset()
    .mockResolvedValue({ status: 'OK', value: { exhausted: false } });
});

describe('chat agent with credits', () => {
  it('registers the workspace tool with grounded retrieval and reuse instructions', async () => {
    const tools = await specSyncAgent.listTools();
    expect(tools['renderVehicleWorkspace']?.id).toBe('renderVehicleWorkspace');
    const instructions = await specSyncAgent.getInstructions();
    expect(instructions).toContain('Use renderVehicleWorkspace');
    expect(instructions).toContain(
      'requires 1–12 relevant supported attributes',
    );
    expect(instructions).toContain(
      'Never omit attributes or supply an empty array',
    );
    expect(instructions).toContain(
      'Never make a second call just to decorate existing results',
    );
    expect(instructions).toContain(
      'Review panels contain opinions, not verified specifications',
    );
  });

  it('admits once and charges every step under its own key', async () => {
    const run = new CreditsRun('u-1', 'r-1', 't-1');
    const text = await drain(agent(scriptedModel(1)), contextWithRun(run));
    expect(text).toBe('done');
    // Two steps: the tool call and the answer, on one admission.
    expect(modelCalls).toBe(2);
    expect(openRun).toHaveBeenCalledTimes(1);
    expect(openRun).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({
        provider: 'openrouter',
        modelId: 'anthropic/claude-sonnet-5',
      }),
    );
    // Two steps, each charged once: `stopWhen` and `onStepFinish` derive the
    // same key for the step they both see.
    expect(stepKeys()).toHaveLength(2);
    expect(new Set(stepKeys()).size).toBe(2);
    expect(stepKeys().every((key) => key.startsWith('step-'))).toBe(true);
    expect(reportUsage.mock.calls[0]?.[2]).toMatchObject({
      inputTokens: 10,
      outputTokens: 1,
      estimated: false,
    });
    expect(finishRun).toHaveBeenCalledWith('u-1', 'r-1', 'COMPLETED');
  });

  it('stops the loop after the step that exhausts the wallet', async () => {
    reportUsage.mockResolvedValue({
      status: 'OK',
      value: { charge: 1, balance: 0, available: 0, exhausted: true },
    });
    finishRun.mockResolvedValue({ status: 'OK', value: { exhausted: true } });
    const run = new CreditsRun('u-1', 'r-1', undefined);
    // The model would otherwise keep calling the tool for ten steps.
    const text = await drain(
      agent(scriptedModel(MAX_CHAT_STEPS)),
      contextWithRun(run),
    );
    expect(modelCalls).toBe(1);
    // No error: the streamed text stays and the run is closed as exhausted.
    expect(text).toBe('');
    expect(stepKeys()).toHaveLength(1);
    expect(finishRun).toHaveBeenCalledWith('u-1', 'r-1', 'EXHAUSTED');
    expect(run.exhausted).toBe(true);
  });

  it('charges the last step before it closes the run', async () => {
    // `onStepFinish` charges detached; the wallet answers 409 for usage on a
    // closed run, so the close has to wait for it.
    const order: string[] = [];
    const pending: Array<() => void> = [];
    reportUsage.mockImplementation(
      (_uid: unknown, _runId: unknown, body: { stepKey: string }) =>
        new Promise((resolve) => {
          pending.push(() => {
            order.push(`usage:${body.stepKey}`);
            resolve({
              status: 'OK',
              value: { charge: 1, balance: 1, available: 1, exhausted: false },
            });
          });
          // Settle a step only after the loop had a chance to finish.
          setTimeout(() => pending.shift()?.(), 20);
        }),
    );
    finishRun.mockImplementation(() => {
      order.push('finish');
      return Promise.resolve({ status: 'OK', value: { exhausted: false } });
    });

    const run = new CreditsRun('u-1', 'r-1', undefined);
    await drain(agent(scriptedModel(1)), contextWithRun(run));
    // The detached charge of the answer step is awaited by `finish`.
    await vi.waitFor(() => expect(order.at(-1)).toBe('finish'));
    expect(order.filter((entry) => entry.startsWith('usage:'))).toHaveLength(2);
    expect(order.indexOf('finish')).toBe(order.length - 1);
  });

  it('closes an aborted run as stopped', async () => {
    const controller = new AbortController();
    const run = new CreditsRun('u-1', 'r-1', undefined);
    const slow = new MockLanguageModelV3({
      doStream: () =>
        Promise.resolve({
          stream: new ReadableStream({
            async start(c) {
              c.enqueue({ type: 'text-start', id: 't' } as never);
              for (let i = 0; i < 20; i += 1) {
                await new Promise((resolve) => setTimeout(resolve, 20));
                c.enqueue({
                  type: 'text-delta',
                  id: 't',
                  delta: 'x',
                } as never);
              }
              c.close();
            },
          }),
        } as never),
    });
    const stream = await agent(slow).stream('hi', {
      requestContext: contextWithRun(run),
      abortSignal: controller.signal,
    });
    setTimeout(() => controller.abort(), 40);
    try {
      for await (const chunk of stream.fullStream) {
        void chunk;
      }
    } catch {
      // An aborted stream may reject; the wallet still has to be released.
    }
    await vi.waitFor(() =>
      expect(finishRun).toHaveBeenCalledWith('u-1', 'r-1', 'STOPPED'),
    );
    expect(finishRun).toHaveBeenCalledTimes(1);
  });

  it('closes a failed run as failed', async () => {
    const run = new CreditsRun('u-1', 'r-1', undefined);
    const broken = new MockLanguageModelV3({
      doStream: () => Promise.reject(new Error('provider is down')),
    });
    try {
      await drain(agent(broken), contextWithRun(run));
    } catch {
      // The loop surfaces the failure; the wallet still has to be released.
    }
    await vi.waitFor(() =>
      expect(finishRun).toHaveBeenCalledWith('u-1', 'r-1', 'FAILED'),
    );
    expect(finishRun).toHaveBeenCalledTimes(1);
  });

  it('keeps the step cap when the wallet stays funded', async () => {
    const run = new CreditsRun('u-1', 'r-1', undefined);
    await drain(agent(scriptedModel(MAX_CHAT_STEPS + 5)), contextWithRun(run));
    expect(modelCalls).toBe(MAX_CHAT_STEPS);
  });

  it('rejects before any model call when admission fails', async () => {
    openRun.mockResolvedValue({
      status: 'INSUFFICIENT_CREDITS',
      available: 120_000,
      minimumCharge: 185_000,
      cheaperModels: ['gemini-2.5-flash'],
    });
    const run = new CreditsRun('u-1', 'r-1', undefined);
    await expect(
      drain(agent(scriptedModel(0)), contextWithRun(run)),
    ).rejects.toThrow(/^INSUFFICIENT_CREDITS: Your AI credits /);
    expect(modelCalls).toBe(0);
    expect(reportUsage).not.toHaveBeenCalled();
  });

  it('leaves a run without credits untouched', async () => {
    const text = await drain(agent(scriptedModel(1)), contextWithRun());
    expect(text).toBe('done');
    expect(modelCalls).toBe(2);
    expect(openRun).not.toHaveBeenCalled();
    expect(reportUsage).not.toHaveBeenCalled();
    expect(finishRun).not.toHaveBeenCalled();
  });

  it('keeps the options of a run without credits as they were', () => {
    expect(chatDefaultOptions({ requestContext: contextWithRun() })).toEqual({
      maxSteps: MAX_CHAT_STEPS,
      providerOptions: { google: { thinkingConfig: {} } },
    });
  });

  it('resolves the model of a run without credits without touching the wallet', async () => {
    await expect(
      chatModelWithCredits({ requestContext: contextWithRun() }),
    ).resolves.toBe(model);
    expect(openRun).not.toHaveBeenCalled();
  });
});
