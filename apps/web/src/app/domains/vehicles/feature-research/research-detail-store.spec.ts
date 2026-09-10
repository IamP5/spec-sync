import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { provideFakeAuth, testSession } from '../../../testing/fake-auth';
import {
  RESEARCH_ID,
  researchDraft,
  researchSnapshot,
  SECOND_RESEARCH_ID,
} from '../../../testing/research-fixtures';
import { RESEARCH_POLL_MS, ResearchDetailStore } from './research-detail-store';

describe('ResearchDetailStore', () => {
  let http: HttpTestingController;
  let store: InstanceType<typeof ResearchDetailStore>;
  const url = (id = RESEARCH_ID) => `/ai/chat/research/${id}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideFakeAuth(),
        ResearchDetailStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ResearchDetailStore);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });
  async function settle(): Promise<void> {
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }
  async function load(): Promise<void> {
    store.load(RESEARCH_ID);
    TestBed.tick();
    http.expectOne(url()).flush(researchSnapshot());
    await settle();
  }

  async function loadCompleted(): Promise<void> {
    store.load(RESEARCH_ID);
    TestBed.tick();
    http.expectOne(url()).flush(researchDraft());
    await settle();
  }

  it('loads legacy research without inventing a normalization revision', async () => {
    store.load(RESEARCH_ID);
    TestBed.tick();
    http.expectOne(url()).flush(
      researchSnapshot({
        status: 'REVIEW',
        ontologyRevision: 0,
        normalizationRevision: null,
      }),
    );
    await settle();
    expect(store.view()?.id).toBe(RESEARCH_ID);
    expect(store.view()?.normalizationRevision).toBeNull();
    expect(store.researchError()).toBeUndefined();
  });

  it('reinterprets saved evidence once and follows the new persisted request', async () => {
    await loadCompleted();
    store.reinterpret();
    store.reinterpret();
    const replay = http.expectOne({ method: 'POST', url: `${url()}/replay` });
    expect(replay.request.body).toEqual({ id: expect.any(String) });
    const newId = replay.request.body.id as string;
    replay.flush(
      researchSnapshot({
        id: newId,
        replayedFromWorkId: researchDraft().workId,
      }),
    );
    await Promise.resolve();
    TestBed.tick();
    http
      .expectOne(url(newId))
      .flush(researchSnapshot({ id: newId, status: 'QUEUED' }));
    await settle();
    expect(store.view()?.id).toBe(newId);
    expect(store.polling()).toBe(true);
    expect(store.reinterpretationError()).toBe('');
  });

  it('retries an uncertain replay response with the same idempotency key', async () => {
    await loadCompleted();
    store.reinterpret();
    const first = http.expectOne({ method: 'POST', url: `${url()}/replay` });
    const body: unknown = first.request.body;
    first.flush({}, { status: 502, statusText: 'Bad Gateway' });
    await settle();
    expect(store.reinterpretationError()).toContain('Could not reinterpret');
    store.reinterpret();
    const retry = http.expectOne({ method: 'POST', url: `${url()}/replay` });
    expect(retry.request.body).toEqual(body);
    retry.flush({}, { status: 503, statusText: 'Service Unavailable' });
    await settle();
    expect(store.view()?.id).toBe(RESEARCH_ID);
  });

  it('ignores a replay response after switching requests or account', async () => {
    await loadCompleted();
    store.reinterpret();
    const replay = http.expectOne({ method: 'POST', url: `${url()}/replay` });
    testSession().invalidate();
    const generation = testSession().begin('bob');
    testSession().establish('bob', generation);
    replay.flush(researchSnapshot({ id: SECOND_RESEARCH_ID }));
    await settle();
    expect(store.view()).toBeNull();
    expect(store.id()).toBe('');
    http.expectNone(url(SECOND_RESEARCH_ID));
  });

  it('polls an active request and stops at review, independently of any agent run', async () => {
    const interval = vi.spyOn(globalThis, 'setInterval');
    const clear = vi.spyOn(globalThis, 'clearInterval');
    await load();
    expect(store.view()?.disposition).toBe('JOINED');
    expect(store.polling()).toBe(true);
    const index = interval.mock.calls.findIndex(
      (call) => call[1] === RESEARCH_POLL_MS,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const callback = interval.mock.calls[index][0];
    if (typeof callback !== 'function')
      throw new Error('Polling callback missing');
    callback();
    TestBed.tick();
    http.expectOne(url()).flush(researchSnapshot({ status: 'REVIEW' }));
    await settle();
    expect(store.polling()).toBe(false);
    expect(clear).toHaveBeenCalledWith(interval.mock.results[index].value);
  });

  it('cancels stale reads and hides the previous request while switching', async () => {
    store.load(RESEARCH_ID);
    TestBed.tick();
    const old = http.expectOne(url());
    store.load(SECOND_RESEARCH_ID);
    expect(store.view()).toBeNull();
    TestBed.tick();
    expect(old.cancelled).toBe(true);
    http
      .expectOne(url(SECOND_RESEARCH_ID))
      .flush(researchSnapshot({ id: SECOND_RESEARCH_ID }));
    await settle();
    expect(store.view()?.id).toBe(SECOND_RESEARCH_ID);
  });

  it('a confirmed detach wins over a late active polling response', async () => {
    await load();
    store.reload();
    TestBed.tick();
    const stale = http.expectOne(url());
    store.detach();
    http
      .expectOne({ method: 'DELETE', url: url() })
      .flush(researchSnapshot({ requestStatus: 'CANCELLED' }));
    await Promise.resolve();
    stale.flush(researchSnapshot());
    await settle();
    expect(store.view()?.requestStatus).toBe('CANCELLED');
    expect(store.polling()).toBe(false);
  });

  it('ignores a detach response for a request that is no longer selected', async () => {
    await load();
    store.detach();
    const detach = http.expectOne({ method: 'DELETE', url: url() });
    store.load(SECOND_RESEARCH_ID);
    TestBed.tick();
    http
      .expectOne(url(SECOND_RESEARCH_ID))
      .flush(researchSnapshot({ id: SECOND_RESEARCH_ID }));
    detach.flush(researchSnapshot({ requestStatus: 'CANCELLED' }));
    await settle();
    expect(store.view()?.id).toBe(SECOND_RESEARCH_ID);
    expect(store.view()?.requestStatus).toBe('ACTIVE');
  });

  it('synchronously forgets account data and rejects late mutation results after logout', async () => {
    await load();
    store.detach();
    const detach = http.expectOne({ method: 'DELETE', url: url() });
    testSession().invalidate();
    expect(store.view()).toBeNull();
    expect(store.polling()).toBe(false);
    const generation = testSession().begin('bob');
    testSession().establish('bob', generation);
    detach.flush(researchSnapshot({ requestStatus: 'CANCELLED' }));
    await settle();
    expect(store.view()).toBeNull();
    expect(store.snapshot()).toBeNull();
    http.expectNone(url());
  });

  it('aborts in-flight source reads immediately when the session is invalidated', async () => {
    store.load(RESEARCH_ID);
    TestBed.tick();
    const pending = http.expectOne(url());
    testSession().invalidate();
    TestBed.tick();
    expect(pending.cancelled).toBe(true);
    expect(store.view()).toBeNull();
  });
});
