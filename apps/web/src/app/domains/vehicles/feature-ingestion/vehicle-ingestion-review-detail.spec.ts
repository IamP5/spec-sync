import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { IngestionRun } from '../data/ingestion-contracts';
import { IngestionDetailStore } from './ingestion-detail-store';
import { VehicleIngestionReviewDetail } from './vehicle-ingestion-review-detail';

const HASH = 'a'.repeat(64);
const claim = {
  attributeCode: 'torque_max',
  label: 'Torque',
  unit: 'Nm',
  rawValue: '60',
  rawUnit: 'kgf.m',
  availability: null,
  listValue: null,
  qualifiers: { rpm: '2000' },
  lineStart: 2,
  lineEnd: 2,
  excerpt: '60 kgf.m',
  locator: 'Page 1',
  value: 588.399,
  issues: [] as string[],
};
/** Limited: torque pre-approved, power in conflict, payload unverified. XLT: one pre-approved torque. */
const run: IngestionRun = {
  id: '00000000-0000-4000-8000-000000000001',
  request: {
    sourceUrl: 'https://www.ford.com.br/specs',
    brand: 'Ford',
    model: 'Ranger',
    market: 'BR',
    modelYear: 2026,
    configurations: [],
  },
  status: 'REVIEW',
  attempts: 1,
  draftHash: HASH,
  baseRevision: 4,
  configurationIds: {},
  error: null,
  projectionStatus: 'NOT_REQUESTED',
  projectionError: null,
  currentValues: {},
  createdAt: '2026-09-06T10:00:00Z',
  updatedAt: '2026-09-06T10:05:00Z',
  decisions: [],
  draft: {
    source: {
      url: 'https://www.ford.com.br/specs',
      title: 'Manufacturer brochure',
      mimeType: 'text/html',
      text: 'Ranger 2026\n60 kgf.m\n250 cv\n254 cv\n—',
      textSha256: 'b'.repeat(64),
      parserVersion: 'test',
    },
    warnings: [],
    configurations: [
      {
        name: 'Limited',
        identityLineStart: 1,
        identityLineEnd: 1,
        identityExcerpt: 'Ranger 2026',
        warnings: [],
        claims: [
          claim,
          {
            ...claim,
            attributeCode: 'power',
            label: 'Power',
            unit: 'cv',
            rawValue: '250',
            rawUnit: 'cv',
            value: 250,
            lineStart: 3,
            lineEnd: 3,
            excerpt: '250 cv',
          },
          {
            ...claim,
            attributeCode: 'power',
            label: 'Power',
            unit: 'cv',
            rawValue: '254',
            rawUnit: 'cv',
            value: 254,
            lineStart: 4,
            lineEnd: 4,
            excerpt: '254 cv',
          },
          {
            ...claim,
            attributeCode: 'payload',
            label: 'Payload',
            unit: 'kg',
            rawValue: '—',
            rawUnit: 'kg',
            qualifiers: {},
            lineStart: 5,
            lineEnd: 5,
            excerpt: '—',
            value: null,
            issues: ['Ambiguous source value'],
          },
        ],
      },
      {
        name: 'XLT',
        identityLineStart: 1,
        identityLineEnd: 1,
        identityExcerpt: 'Ranger 2026',
        warnings: [],
        claims: [claim],
      },
    ],
  },
};

describe('Guided research review', () => {
  function fakeStore(initial: IngestionRun = run) {
    return {
      runValue: signal<IngestionRun | undefined>(structuredClone(initial)),
      runIsLoading: signal(false),
      runError: signal(undefined),
      sessionScope: signal({ uid: 'alice' }),
      publishError: signal(undefined),
      publishIsPending: signal(false),
      load: vi.fn(),
      reload: vi.fn(),
      publish: vi.fn().mockResolvedValue({ status: 'success', value: run }),
    };
  }
  async function setup(initial: IngestionRun = run, open = true) {
    const store = fakeStore(initial);
    await TestBed.configureTestingModule({
      imports: [VehicleIngestionReviewDetail],
      providers: [provideRouter([])],
    })
      .overrideComponent(VehicleIngestionReviewDetail, {
        set: {
          providers: [{ provide: IngestionDetailStore, useValue: store }],
        },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(VehicleIngestionReviewDetail);
    fixture.componentRef.setInput('researchId', 'private-request');
    fixture.componentRef.setInput('open', open);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const click = (selector: string) => {
      const button = element.querySelector<HTMLButtonElement>(selector);
      expect(button, selector).toBeTruthy();
      button?.click();
      return fixture.whenStable();
    };
    const queue = () =>
      [
        ...element.querySelectorAll<HTMLElement>(
          '[data-role="decision-queue"] [data-decision]',
        ),
      ].map((item) => `${item.dataset['decision']}:${item.dataset['status']}`);
    return { fixture, store, element, click, queue };
  }
  const text = (element: HTMLElement, selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  it('loads the research review with the account and pre-approves the evidenced candidates', async () => {
    const { store, element, queue } = await setup();
    expect(store.load).toHaveBeenLastCalledWith('', 'private-request');
    expect(text(element, '[data-role="review-totals"]')).toBe(
      '2 selected · 2 pending · 0 published',
    );
    expect(queue()).toEqual([
      'torque_max:selected',
      'power:pending',
      'payload:pending',
    ]);
    expect(
      element.querySelector('[data-decision="torque_max"][data-kind="auto"]'),
    ).toBeTruthy();
    expect(text(element, '[data-role="decision-position"]')).toBe(
      'Decision 1 of 3 · Limited',
    );
    expect(text(element, '[data-role="pre-approved"]')).toContain(
      '2 attributes pre-approved',
    );
  });

  it('walks to the pending decisions, takes one candidate of a conflict and acknowledges unverified evidence', async () => {
    const { element, click, queue } = await setup();
    await click('[data-action="next-pending"]');
    expect(text(element, '[data-role="decision-position"]')).toBe(
      'Decision 2 of 3 · Limited',
    );
    expect(
      element.querySelector('[data-decision="power"][data-kind="conflict"]'),
    ).toBeTruthy();
    await click('[data-candidate="2"] [data-action="choose"]');
    expect(queue()).toContain('power:selected');
    expect(text(element, '[data-role="proposed-value"]')).toBe('254 cv');
    await click('[data-candidate="1"] [data-action="choose"]');
    expect(text(element, '[data-role="proposed-value"]')).toBe('250 cv');
    await click('[data-action="next-pending"]');
    expect(
      element.querySelector(
        '[data-decision="payload"][data-kind="unverified"]',
      ),
    ).toBeTruthy();
    expect(
      element.querySelector('[data-decision="payload"] [data-action="choose"]'),
    ).toBeNull();
    await click('[data-action="defer"]');
    expect(queue()).toEqual([
      'torque_max:selected',
      'power:selected',
      'payload:deferred',
    ]);
    expect(text(element, '[data-role="review-totals"]')).toBe(
      '3 selected · 0 pending · 0 published',
    );
    expect(text(element, '[data-action="next-pending"]')).toContain(
      'Nothing pending',
    );
  });

  it('keeps each configuration apart and requires identity per participating configuration plus a reason', async () => {
    const { fixture, store, element, click } = await setup();
    await click('[data-configuration="XLT"]');
    expect(text(element, '[data-role="decision-position"]')).toBe(
      'Decision 1 of 1 · XLT',
    );
    await click('[data-action="clear"]');
    await click('[data-configuration="Limited"]');
    expect(text(element, '[data-role="selection-summary"]')).toBe(
      '1 selected in 1 configuration(s)',
    );
    await click('[data-action="review-publication"]');
    const publish = element.querySelector<HTMLButtonElement>(
      '[data-action="publish"]',
    )!;
    expect(publish.disabled).toBe(true);
    expect(element.querySelectorAll('[data-batch]')).toHaveLength(1);
    const reason = element.querySelector<HTMLTextAreaElement>(
      '[data-role="review-reason"]',
    )!;
    reason.value = 'Checked exact trim and year';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(publish.disabled).toBe(true);
    expect(text(element, '[data-role="unconfirmed"]')).toContain('Limited');
    const identity = element.querySelector<HTMLInputElement>(
      '[data-batch="Limited"] [data-role="identity"]',
    )!;
    identity.click();
    await fixture.whenStable();
    expect(publish.disabled).toBe(false);
    const own = element.querySelector<HTMLTextAreaElement>(
      '[data-batch="Limited"] [data-role="configuration-reason"]',
    )!;
    own.value = 'Limited column only';
    own.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(store.publish).toHaveBeenCalledWith({
      draftHash: HASH,
      baseRevision: run.baseRevision,
      reason: 'Checked exact trim and year',
      configurations: [
        {
          configuration: 0,
          identityConfirmed: true,
          selectedClaims: [0],
          reason: 'Limited column only',
        },
      ],
    });
    expect(text(element, '[data-role="receipt"]')).toContain(
      '1 specification(s) published for 1 configuration(s)',
    );
  });

  it('shows what this research already published as final and keeps the rest open after a partial publication', async () => {
    const partial: IngestionRun = {
      ...run,
      status: 'PUBLISHED',
      baseRevision: 5,
      decisions: [
        {
          draftHash: HASH,
          baseRevision: 4,
          reason: 'first',
          configurations: [
            { configuration: 0, identityConfirmed: true, selectedClaims: [0] },
          ],
        },
      ],
    };
    const { element, click, queue } = await setup(partial);
    expect(text(element, '[data-role="review-totals"]')).toBe(
      '1 selected · 2 pending · 1 published',
    );
    expect(queue()).toEqual([
      'torque_max:published',
      'power:pending',
      'payload:pending',
    ]);
    expect(
      element.querySelector(
        '[data-decision="torque_max"] [data-action="choose"]',
      ),
    ).toBeNull();
    expect(
      element.querySelector(
        '[data-decision="torque_max"] [data-action="defer"]',
      ),
    ).toBeNull();
    await click('[data-filter="published"]');
    expect(queue()).toEqual(['torque_max:published']);
    await click('[data-filter="pending"]');
    expect(queue()).toEqual(['power:pending', 'payload:pending']);
  });

  it('carries the reviewer choices over the revision its own publication creates', async () => {
    const { fixture, store, element, click, queue } = await setup();
    await click('[data-action="next-pending"]');
    await click('[data-candidate="2"] [data-action="choose"]');
    await click('[data-configuration="XLT"]');
    await click('[data-action="clear"]');
    store.runValue.set({
      ...structuredClone(run),
      status: 'PUBLISHED',
      baseRevision: 5,
      decisions: [
        {
          draftHash: HASH,
          baseRevision: 4,
          reason: 'first',
          configurations: [
            { configuration: 0, identityConfirmed: true, selectedClaims: [0] },
          ],
        },
      ],
    });
    await fixture.whenStable();
    expect(queue()).toEqual(['torque_max:pending']);
    await click('[data-configuration="Limited"]');
    expect(queue()).toEqual([
      'torque_max:published',
      'power:selected',
      'payload:pending',
    ]);
    expect(text(element, '[data-role="proposed-value"]')).toBe('254 cv');
  });

  it('shows only the summary strip until the reader opens the decisions', async () => {
    const { element, click } = await setup(run, false);
    expect(element.querySelector('[data-role="decision-queue"]')).toBeNull();
    expect(text(element, '[data-role="pending-count"]')).toBe('2');
    expect(text(element, '[data-role="review-totals"]')).toBe(
      '2 selected · 2 pending · 0 published',
    );
    await click('[data-action="toggle-review"]');
  });
});
