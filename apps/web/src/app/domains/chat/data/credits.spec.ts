import {
  creditsViewSchema,
  formatCredits,
  usedShare,
  walletOf,
} from './credits';

const wallet = {
  enabled: true,
  uid: 'abc',
  unit: 'CREDITS',
  balance: 146_400_000,
  available: 146_400_000,
  granted: 200_000_000,
  spent: 53_600_000,
  exhausted: false,
  models: [
    {
      provider: 'openrouter',
      modelId: 'google/gemini-3.8-flash',
      tariffVersion: 1,
      inputPerMillion: 150_000_000,
      cachedInputPerMillion: 37_500_000,
      outputPerMillion: 900_000_000,
      minimumCharge: 370_000,
      affordable: true,
    },
  ],
  recentRuns: [
    {
      runId: 'r1',
      startedAt: '2026-09-07T12:00:00Z',
      finishedAt: '2026-09-07T12:00:04Z',
      modelId: 'google/gemini-3.8-flash',
      status: 'COMPLETED',
      charge: 1_300_000,
    },
  ],
};

describe('formatCredits', () => {
  it('names a whole amount of credits, grouped, from one credit up', () => {
    expect(formatCredits(183_000_000)).toBe('183');
    expect(formatCredits(1_204_000_000)).toBe('1,204');
    expect(formatCredits(1_000_000)).toBe('1');
  });

  it('names a fraction of a credit with two decimals', () => {
    expect(formatCredits(420_000)).toBe('0.42');
    expect(formatCredits(10_000)).toBe('0.01');
  });

  it('names an amount below a hundredth instead of rounding it away', () => {
    expect(formatCredits(1)).toBe('less than 0.01');
    expect(formatCredits(9_999)).toBe('less than 0.01');
  });

  it('clamps a negative balance to nothing left', () => {
    expect(formatCredits(-1)).toBe('0');
    expect(formatCredits(-2_500_000)).toBe('0');
    expect(formatCredits(0)).toBe('0');
  });

  it('never names money', () => {
    expect(formatCredits(146_400_000)).not.toContain('R$');
  });
});

describe('creditsViewSchema', () => {
  it('reads the wallet the AI service returns', () => {
    const view = creditsViewSchema.parse(wallet);
    expect(view.enabled).toBe(true);
    expect(walletOf(view)?.unit).toBe('CREDITS');
    expect(walletOf(view)?.balance).toBe(146_400_000);
    expect(walletOf(view)?.models[0].affordable).toBe(true);
  });

  it('reads the disabled answer and has no wallet then', () => {
    const view = creditsViewSchema.parse({ enabled: false });
    expect(view.enabled).toBe(false);
    expect(walletOf(view)).toBeUndefined();
    expect(walletOf(undefined)).toBeUndefined();
  });

  it('defaults the lists the service may leave out', () => {
    const view = creditsViewSchema.parse({
      ...wallet,
      models: undefined,
      recentRuns: undefined,
    });
    expect(walletOf(view)?.models).toEqual([]);
    expect(walletOf(view)?.recentRuns).toEqual([]);
  });

  it('rejects an answer without the flag', () => {
    expect(() => creditsViewSchema.parse({ balance: 1 })).toThrow();
  });
});

describe('usedShare', () => {
  it('is the spent share of the grant', () => {
    expect(usedShare(walletOf(creditsViewSchema.parse(wallet)))).toBeCloseTo(
      0.268,
    );
  });

  it('is nothing without a wallet and everything without a grant', () => {
    expect(usedShare(undefined)).toBe(0);
    expect(
      usedShare(walletOf(creditsViewSchema.parse({ ...wallet, granted: 0 }))),
    ).toBe(1);
  });

  it('stays between nothing and everything', () => {
    expect(
      usedShare(
        walletOf(creditsViewSchema.parse({ ...wallet, spent: 240_000_000 })),
      ),
    ).toBe(1);
  });
});
