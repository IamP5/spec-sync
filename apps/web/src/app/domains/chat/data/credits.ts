import { z } from 'zod';

/**
 * AI credits route of the AI service, reached through the `/ai` proxy of the
 * web server. Part of the contract with `apps/ai` (`credits-route.ts`); the
 * gateway allows exactly this one GET.
 */
export const CREDITS_URL = '/ai/chat/credits';

/** One credit in the integer unit the wallet is kept in (micro-credits). */
export const MICRO_PER_CREDIT = 1_000_000;

/** Below a hundredth of a credit an amount is named instead of shown. */
const SMALLEST_SHOWN = 0.01;

/**
 * One pair of number formats per locale. The document runs in a single
 * language, so this holds one entry in practice; the map only keeps the
 * function pure for the callers that pass a different one.
 */
const formats = new Map<
  string,
  { whole: Intl.NumberFormat; fraction: Intl.NumberFormat }
>();

function formatsFor(locale: string) {
  let format = formats.get(locale);
  if (!format) {
    format = {
      whole: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
      fraction: new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    };
    formats.set(locale, format);
  }
  return format;
}

const modelPriceSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  tariffVersion: z.number(),
  /** Micro-credits per one million uncached input tokens. */
  inputPerMillion: z.number(),
  cachedInputPerMillion: z.number(),
  outputPerMillion: z.number(),
  /** What a minimum useful answer on this model costs. */
  minimumCharge: z.number(),
  /** True while the available balance covers `minimumCharge`. */
  affordable: z.boolean(),
});

const runChargeSchema = z.object({
  runId: z.string().min(1),
  startedAt: z.string(),
  finishedAt: z.string().nullish(),
  modelId: z.string().min(1),
  status: z.string(),
  charge: z.number(),
});

/** The wallet as the API returns it, plus the flag the AI service adds. */
const enabledWalletSchema = z.object({
  enabled: z.literal(true),
  uid: z.string().min(1),
  /** The unit the integers are counted in; `CREDITS` since the second release. */
  unit: z.string().min(1),
  /** Sum of the ledger; can be slightly negative after the exhausting step. */
  balance: z.number(),
  /** Balance minus the open holds; `exhausted` is `available <= 0`. */
  available: z.number(),
  granted: z.number(),
  spent: z.number(),
  exhausted: z.boolean(),
  models: z.array(modelPriceSchema).default([]),
  recentRuns: z.array(runChargeSchema).default([]),
});

const disabledWalletSchema = z.object({ enabled: z.literal(false) });

/**
 * `GET /ai/chat/credits`. The service answers `{ "enabled": false }` while the
 * feature flag is unset, in which case the browser hides every credits
 * element and the chat behaves as it did before the wallet existed.
 */
export const creditsViewSchema = z.discriminatedUnion('enabled', [
  enabledWalletSchema,
  disabledWalletSchema,
]);

export type CreditsModelPrice = z.infer<typeof modelPriceSchema>;
export type CreditsRunCharge = z.infer<typeof runChargeSchema>;
export type CreditsWallet = z.infer<typeof enabledWalletSchema>;
export type CreditsView = z.infer<typeof creditsViewSchema>;

export function parseCreditsView(value: unknown): CreditsView {
  return creditsViewSchema.parse(value);
}

/** The wallet when credits are on, otherwise nothing. */
export function walletOf(
  view: CreditsView | undefined,
): CreditsWallet | undefined {
  return view?.enabled ? view : undefined;
}

/**
 * An amount of micro-credits as the product names it. Money never reaches the
 * surface: the four rules are a whole grouped number from one credit up
 * (`183`, `1,204`), two decimals below it (`0.42`), a named amount below a
 * hundredth (`less than 0.01`), and nothing left (`0`). A negative balance is
 * clamped, since the wallet may end a run slightly below zero.
 *
 * The word "credits" is not part of the amount; it is added where no label
 * already implies it.
 */
/**
 * Whether an amount is too small to show, so callers that wrap it can leave
 * out an approximation sign that "less than" already implies.
 */
export function isBelowSmallestShown(micro: number): boolean {
  return (
    Number.isFinite(micro) &&
    micro > 0 &&
    micro / MICRO_PER_CREDIT < SMALLEST_SHOWN
  );
}

export function formatCredits(micro: number, locale = 'en-US'): string {
  const { whole, fraction } = formatsFor(locale);
  if (!Number.isFinite(micro) || micro <= 0) {
    return whole.format(0);
  }
  const credits = micro / MICRO_PER_CREDIT;
  if (credits < SMALLEST_SHOWN) {
    const smallest = fraction.format(SMALLEST_SHOWN);
    return $localize`less than ${smallest}:amount:`;
  }
  if (credits < 1) {
    return fraction.format(credits);
  }
  return whole.format(credits);
}

/**
 * How much of the grant is used, as a fraction between 0 and 1. Used for the
 * thin bar on the pill; an empty grant reads as fully used.
 */
export function usedShare(wallet: CreditsWallet | undefined): number {
  if (!wallet) {
    return 0;
  }
  if (wallet.granted <= 0) {
    return 1;
  }
  return clamp(wallet.spent / wallet.granted, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
