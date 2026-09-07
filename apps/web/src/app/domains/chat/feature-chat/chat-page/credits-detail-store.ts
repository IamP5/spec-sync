import { computed, inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import {
  signalStore,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { on, withReducer } from '@ngrx/signals/events';

import { sessionEvents } from '../../../auth/api/events';
import {
  type CreditsModelPrice,
  type CreditsRunCharge,
  usedShare,
  walletOf,
} from '../../data/credits';
import { CreditsClient } from '../../data/credits-client';

/**
 * Detail store of the signed-in user's AI credits wallet: one read model,
 * read once per session and read again after every run, since a run is what
 * spends credits. The AI service owns the wallet, so nothing here writes it.
 *
 * While the feature flag is off the service answers `{ enabled: false }` and
 * every derived signal reads as empty, which is how the chat hides the pill
 * and the alerts and behaves exactly as it did before the wallet existed.
 * A failed read is treated the same way: credits never block the chat because
 * the browser could not read them.
 */
export const CreditsDetailStore = signalStore(
  { providedIn: 'root' },

  withProps(() => ({ _client: inject(CreditsClient) })),

  withResource((store) => ({ wallet: store._client.walletResource() })),

  withComputed((store) => ({
    /** The wallet, or nothing while credits are off, unread or unreadable. */
    view: computed(() => walletOf(store.walletValue())),
  })),

  withComputed((store) => ({
    /** True only when the service reported an actual wallet. */
    enabled: computed(() => store.view() !== undefined),
    /** Ledger balance in micro-reais; the UI clamps it when formatting. */
    balance: computed(() => store.view()?.balance ?? 0),
    /** Balance minus the open holds; this is what admission is decided on. */
    available: computed(() => store.view()?.available ?? 0),
    granted: computed(() => store.view()?.granted ?? 0),
    spent: computed(() => store.view()?.spent ?? 0),
    exhausted: computed(() => store.view()?.exhausted ?? false),
    models: computed((): CreditsModelPrice[] => store.view()?.models ?? []),
    recentRuns: computed(
      (): CreditsRunCharge[] => store.view()?.recentRuns ?? [],
    ),
    /** Share of the grant already spent, 0..1, for the bar on the pill. */
    used: computed(() => usedShare(store.view())),
    status: computed(() => store.walletStatus()),
  })),

  withMethods((store) => ({
    /** Reads the wallet again; the coordinator does this after every run. */
    reload(): void {
      store._walletReload();
    },
  })),

  withReducer(
    on(sessionEvents.invalidated, () => ({ walletValue: undefined })),
  ),

  withDevtools('credits'),
);
