import { z } from 'zod';

import { cloudRunHeaders } from '../catalog/cloud-run-auth';
import type { StepUsage } from './usage';

/**
 * Typed client for the wallet the API owns
 * (`/api/internal/ai-credits/**`, see docs/ai-credits-implementation.md).
 *
 * The AI service is the only caller: it is the single place that verifies the
 * user's Firebase token, so the API trusts the `uid` in the path once the
 * shared service key matched. In the cloud the Cloud Run invoker identity is
 * sent next to it, exactly like the catalog client.
 *
 * Every failure is typed. Callers fail closed: with credits enabled an
 * unreachable wallet must stop a run rather than let it run for free.
 */

/** Environment variable that both carries the service key and enables credits. */
export const CREDITS_SERVICE_KEY_ENV = 'SPECSYNC_CREDITS_SERVICE_KEY';

const MIN_KEY_LENGTH = 32;

const BASE_PATH = '/api/internal/ai-credits';

const TIMEOUT_MS = 10_000;

/** How long an active-tariff list is reused before the API is asked again. */
const TARIFF_CACHE_MS = 60_000;

export const modelTariffSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
  tariffVersion: z.number(),
  inputPerMillion: z.number(),
  cachedInputPerMillion: z.number(),
  outputPerMillion: z.number(),
  minimumCharge: z.number(),
  affordable: z.boolean().optional(),
});

export type ModelTariff = z.infer<typeof modelTariffSchema>;

export const walletViewSchema = z.object({
  uid: z.string(),
  unit: z.string(),
  balance: z.number(),
  available: z.number(),
  granted: z.number(),
  spent: z.number(),
  exhausted: z.boolean(),
  models: z.array(modelTariffSchema),
  recentRuns: z.array(
    z.object({
      runId: z.string(),
      startedAt: z.string(),
      finishedAt: z.string().nullish(),
      modelId: z.string(),
      status: z.string(),
      charge: z.number(),
    }),
  ),
});

export type WalletView = z.infer<typeof walletViewSchema>;

export const tariffsSchema = z.object({ models: z.array(modelTariffSchema) });

export const runAdmissionSchema = z.object({
  runId: z.string(),
  hold: z.number(),
  balance: z.number(),
  available: z.number(),
  exhausted: z.boolean(),
});

export type RunAdmission = z.infer<typeof runAdmissionSchema>;

export const usageChargeSchema = z.object({
  charge: z.number(),
  balance: z.number(),
  available: z.number(),
  exhausted: z.boolean(),
});

export type UsageCharge = z.infer<typeof usageChargeSchema>;

/**
 * RFC 9457 body of the `402` the API answers when the balance is too low.
 *
 * The `code` is required: only this one carries the wallet's typed rejection,
 * and any other `402` on the way (a proxy, a gateway, a future problem type)
 * must fall through to `CREDITS_UNAVAILABLE` rather than be shown to the user
 * as an empty balance.
 */
const insufficientSchema = z.object({
  code: z.literal('INSUFFICIENT_CREDITS'),
  available: z.number().default(0),
  minimumCharge: z.number().default(0),
  cheaperModels: z.array(z.string()).default([]),
});

export type InsufficientCredits = Omit<
  z.infer<typeof insufficientSchema>,
  'code'
>;

/** Run status the API stores when the AI service closes a run. */
export type RunStatus = 'COMPLETED' | 'STOPPED' | 'FAILED' | 'EXHAUSTED';

export type CreditsResult<T> =
  | { status: 'OK'; value: T }
  | ({ status: 'INSUFFICIENT_CREDITS' } & InsufficientCredits)
  | { status: 'UNAVAILABLE'; message: string };

/**
 * Credits are on when the service key is configured; the same rule and the
 * same minimum length guard the API side. A too-short key is treated as
 * absent so a misconfiguration never turns into a weak shared secret.
 */
export function creditsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return creditsServiceKey(env) !== undefined;
}

/**
 * The configured service key, or `undefined` when credits are off. The single
 * predicate behind `creditsEnabled` and every request, so a key that is too
 * short can never enable the feature in one place and be sent in another.
 */
export function creditsServiceKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const key = env[CREDITS_SERVICE_KEY_ENV] ?? '';
  return key.length >= MIN_KEY_LENGTH ? key : undefined;
}

export function creditsOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return env['SPECSYNC_API_URL'] ?? 'http://127.0.0.1:8080';
}

export interface UsageReport extends StepUsage {
  stepKey: string;
  provider: string;
  modelId: string;
}

/** Ensures the wallet and the signup grant, and reads the browser's view of it. */
export function fetchWallet(uid: string): Promise<CreditsResult<WalletView>> {
  return creditsRequest(
    'GET',
    `/wallets/${encodeURIComponent(uid)}`,
    undefined,
    walletViewSchema,
  );
}

/** Opens a run: admission, hold and the typed `402` rejection. */
export function openRun(
  uid: string,
  body: {
    runId: string;
    provider: string;
    modelId: string;
    threadId?: string;
  },
): Promise<CreditsResult<RunAdmission>> {
  return creditsRequest(
    'POST',
    `/wallets/${encodeURIComponent(uid)}/runs`,
    body,
    runAdmissionSchema,
  );
}

/** Charges one step; idempotent on `(runId, stepKey)`. */
export function reportUsage(
  uid: string,
  runId: string,
  body: UsageReport,
): Promise<CreditsResult<UsageCharge>> {
  return creditsRequest(
    'POST',
    `/wallets/${encodeURIComponent(uid)}/runs/${encodeURIComponent(runId)}/usage`,
    body,
    usageChargeSchema,
  );
}

/** Releases the remaining hold and closes the run; idempotent. */
export function finishRun(
  uid: string,
  runId: string,
  status: RunStatus,
): Promise<CreditsResult<WalletView>> {
  return creditsRequest(
    'POST',
    `/wallets/${encodeURIComponent(uid)}/runs/${encodeURIComponent(runId)}/finish`,
    { status },
    walletViewSchema,
  );
}

let tariffCache: { models: ModelTariff[]; readAt: number } | undefined;

/** Only for tests: forgets the cached tariff list. */
export function resetTariffCache(): void {
  tariffCache = undefined;
}

/**
 * Active tariffs, cached for a minute. A failed refresh keeps serving the last
 * good list; only the very first failure returns `undefined`, which tells the
 * catalog route to answer unfiltered rather than hide every model.
 */
export async function activeTariffs(
  now: number = Date.now(),
): Promise<ModelTariff[] | undefined> {
  if (tariffCache && now - tariffCache.readAt < TARIFF_CACHE_MS) {
    return tariffCache.models;
  }
  const result = await creditsRequest(
    'GET',
    '/tariffs',
    undefined,
    tariffsSchema,
  );
  if (result.status !== 'OK') {
    return tariffCache?.models;
  }
  tariffCache = { models: result.value.models, readAt: now };
  return tariffCache.models;
}

/**
 * `provider/modelId` of every tariff the last successful refresh reported, or
 * `undefined` while no list was ever read. Synchronous on purpose: role
 * resolution runs inside the model resolver and cannot await a round trip, and
 * an unknown list must leave every model resolvable rather than none.
 */
export function cachedTariffModelIds(): Set<string> | undefined {
  if (!tariffCache) {
    return undefined;
  }
  return new Set(
    tariffCache.models.map((tariff) => `${tariff.provider}/${tariff.modelId}`),
  );
}

async function creditsRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<CreditsResult<T>> {
  const key = creditsServiceKey();
  if (!key) {
    return { status: 'UNAVAILABLE', message: 'The credits key is not set.' };
  }
  const origin = creditsOrigin();
  try {
    const response = await fetch(new URL(`${BASE_PATH}${path}`, origin), {
      method,
      redirect: 'error',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${key}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(await cloudRunHeaders(origin)),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 402) {
      const problem = insufficientSchema.safeParse(await readJson(response));
      if (problem.success) {
        const { code: _code, ...rejection } = problem.data;
        return { status: 'INSUFFICIENT_CREDITS', ...rejection };
      }
      return {
        status: 'UNAVAILABLE',
        message: 'The credits service answered 402.',
      };
    }
    if (!response.ok) {
      return {
        status: 'UNAVAILABLE',
        message: `The credits service answered ${response.status}.`,
      };
    }
    return { status: 'OK', value: schema.parse(await response.json()) };
  } catch {
    return {
      status: 'UNAVAILABLE',
      message: 'The credits service could not be reached.',
    };
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
