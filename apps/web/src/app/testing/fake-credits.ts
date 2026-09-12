import { Injectable, resource, signal } from '@angular/core';

import type {
  CreditsRunCharge,
  CreditsView,
} from '../domains/chat/data/credits';
import { CreditsClient } from '../domains/chat/data/credits-client';

/**
 * In-memory stand-in for the AI credits wallet the AI service owns. It
 * answers `walletResource()` like `CreditsClient` without HTTP, so store and
 * component tests can put a wallet in front of the chat and count how often
 * it was read.
 */
@Injectable()
export class FakeCreditsClient {
  private readonly view = signal<CreditsView>(richWallet());
  /** How often the resource loaded; a run must read the wallet again. */
  reads = 0;

  /** Replaces what the service answers with, for the next read. */
  answerWith(view: CreditsView): void {
    this.view.set(view);
  }

  walletResource() {
    return resource({
      params: () => this.view(),
      loader: ({ params }) => {
        this.reads++;
        return Promise.resolve(params);
      },
    });
  }
}

export function provideFakeCredits() {
  return [
    FakeCreditsClient,
    { provide: CreditsClient, useExisting: FakeCreditsClient },
  ];
}

/** The wallet of a user who has barely used the promotional grant. */
export function richWallet(): CreditsView {
  return wallet({ balance: 146_400_000, spent: 53_600_000 });
}

/** Enough for the cheapest mode only; the expensive ones are out of reach. */
export function lowWallet(): CreditsView {
  return wallet({ balance: 600_000, spent: 199_400_000 });
}

/** Nothing left: the transcript stays readable, the composer does not. */
export function exhaustedWallet(): CreditsView {
  return wallet({ balance: 0, spent: 200_000_000, exhausted: true });
}

/** What the service answers while the feature flag is unset. */
export function disabledWallet(): CreditsView {
  return { enabled: false };
}

function wallet(
  overrides: Partial<Extract<CreditsView, { enabled: true }>> = {},
): CreditsView {
  const balance = overrides.balance ?? 146_400_000;
  return {
    enabled: true,
    uid: 'test-user',
    unit: 'CREDITS',
    balance,
    available: overrides.available ?? balance,
    granted: 200_000_000,
    spent: overrides.spent ?? 0,
    exhausted: false,
    recentRuns: [run('run-1', 'google/gemini-3.8-flash', 1_300_000)],
    ...overrides,
  };
}

function run(runId: string, modelId: string, charge: number): CreditsRunCharge {
  return {
    runId,
    startedAt: '2026-09-07T12:00:00Z',
    finishedAt: '2026-09-07T12:00:04Z',
    modelId,
    status: 'COMPLETED',
    charge,
  };
}
