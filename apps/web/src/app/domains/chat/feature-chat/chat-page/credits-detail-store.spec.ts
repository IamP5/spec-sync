import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Dispatcher } from '@ngrx/signals/events';

import { provideFakeAuth } from '../../../../testing/fake-auth';
import {
  disabledWallet,
  exhaustedWallet,
  FakeCreditsClient,
  provideFakeCredits,
} from '../../../../testing/fake-credits';
import { sessionEvents } from '../../../auth/api/events';
import { CreditsDetailStore } from './credits-detail-store';

describe('CreditsDetailStore', () => {
  let credits: FakeCreditsClient;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [...provideFakeAuth(), ...provideFakeCredits()],
    });
    credits = TestBed.inject(FakeCreditsClient);
  });

  /** Flushes the effects that start the read and waits for it. */
  async function settle(): Promise<void> {
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('reads the wallet of the signed-in user', async () => {
    const store = TestBed.inject(CreditsDetailStore);
    store.enabled();
    await settle();

    expect(store.enabled()).toBe(true);
    expect(store.balance()).toBe(146_400_000);
    expect(store.granted()).toBe(200_000_000);
    expect(store.spent()).toBe(53_600_000);
    expect(store.exhausted()).toBe(false);
    expect(store.used()).toBeCloseTo(0.268);
    expect(store.recentRuns().length).toBeGreaterThan(0);
  });

  it('hides everything when the service reports credits as disabled', async () => {
    credits.answerWith(disabledWallet());
    const store = TestBed.inject(CreditsDetailStore);
    store.enabled();
    await settle();

    expect(store.enabled()).toBe(false);
    expect(store.balance()).toBe(0);
    expect(store.exhausted()).toBe(false);
    expect(store.recentRuns()).toEqual([]);
  });

  it('reports the exhausted wallet', async () => {
    credits.answerWith(exhaustedWallet());
    const store = TestBed.inject(CreditsDetailStore);
    store.enabled();
    await settle();

    expect(store.exhausted()).toBe(true);
    expect(store.balance()).toBe(0);
    expect(store.used()).toBe(1);
  });

  it('reads the wallet again on reload', async () => {
    const store = TestBed.inject(CreditsDetailStore);
    store.enabled();
    await settle();
    const before = credits.reads;

    store.reload();
    await settle();

    expect(credits.reads).toBeGreaterThan(before);
  });

  it('forgets the wallet when the session is invalidated', async () => {
    const store = TestBed.inject(CreditsDetailStore);
    store.enabled();
    await settle();
    expect(store.enabled()).toBe(true);

    TestBed.inject(Dispatcher).dispatch(
      sessionEvents.invalidated({ generation: 2 }),
    );

    expect(store.enabled()).toBe(false);
    expect(store.balance()).toBe(0);
  });
});
