import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { IngestionRun } from '../data/ingestion-contracts';
import { IngestionDetailStore } from './ingestion-detail-store';
import { VehicleIngestionRunDetail } from './vehicle-ingestion-run-detail';

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
const run: IngestionRun = {
  id: '00000000-0000-4000-8000-000000000001',
  request: {
    sourceUrl: 'https://www.ford.com.br/specs',
    brand: 'Ford',
    model: 'Ranger',
    market: 'BR',
    modelYear: 2026,
    configurations: ['Limited', 'XLT'],
  },
  status: 'REVIEW',
  attempts: 1,
  draftHash: 'a'.repeat(64),
  baseRevision: 4,
  configurationIds: {},
  error: null,
  projectionStatus: 'NOT_REQUESTED',
  projectionError: null,
  currentValues: {},
  createdAt: '2026-09-06T10:00:00Z',
  updatedAt: '2026-09-06T10:05:00Z',
  draft: {
    source: {
      url: 'https://www.ford.com.br/specs',
      title: 'Manufacturer brochure',
      mimeType: 'text/html',
      text: 'Ranger 2026\n60 kgf.m\n61 kgf.m\n—',
      textSha256: 'b'.repeat(64),
      parserVersion: 'test',
    },
    warnings: [
      'The source also presents configurations that were not requested: Raptor.',
    ],
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
            rawValue: '61',
            value: 598.2,
            lineStart: 3,
            lineEnd: 3,
            excerpt: '61 kgf.m',
          },
          {
            ...claim,
            attributeCode: 'payload',
            label: 'Payload',
            unit: 'kg',
            rawValue: '—',
            rawUnit: 'kg',
            qualifiers: {},
            lineStart: 4,
            lineEnd: 4,
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
        warnings: [
          'No supported specification was extracted for this configuration.',
        ],
        claims: [],
      },
    ],
  },
};

describe('Vehicle ingestion run review', () => {
  function fakeStore() {
    return {
      runValue: signal<IngestionRun | undefined>(structuredClone(run)),
      runIsLoading: signal(false),
      runError: signal(undefined),
      hasKey: signal(true),
      sessionScope: signal({ uid: 'alice' }),
      publishError: signal(undefined),
      rejectError: signal(undefined),
      downloadSourceIsPending: signal(false),
      downloadSourceError: signal(null),
      downloadSource: vi.fn(),
      publishIsPending: signal(false),
      rejectIsPending: signal(false),
      load: vi.fn(),
      reload: vi.fn(),
      setKey: vi.fn(),
      publish: vi.fn().mockResolvedValue({ status: 'success', value: run }),
      reject: vi.fn(),
    };
  }
  async function setup() {
    const store = fakeStore();
    await TestBed.configureTestingModule({
      imports: [VehicleIngestionRunDetail],
      providers: [provideRouter([])],
    })
      .overrideComponent(VehicleIngestionRunDetail, {
        set: {
          providers: [{ provide: IngestionDetailStore, useValue: store }],
        },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(VehicleIngestionRunDetail);
    fixture.componentRef.setInput('runId', run.id);
    const changes: unknown[] = [];
    fixture.componentInstance.runChanged.subscribe((summary) =>
      changes.push(summary),
    );
    await fixture.whenStable();
    return {
      fixture,
      store,
      changes,
      element: fixture.nativeElement as HTMLElement,
    };
  }
  const publishButton = (element: HTMLElement) =>
    element.querySelector<HTMLButtonElement>('[data-action="publish"]')!;
  const claimBox = (element: HTMLElement, index: number) =>
    element.querySelector<HTMLInputElement>(
      `[data-claim="${index}"] input[type="checkbox"]`,
    )!;
  const check = (box: HTMLInputElement, checked: boolean) => {
    box.checked = checked;
    box.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('loads the run, reports a credential-free summary and shows coverage warnings', async () => {
    const { store, changes, element } = await setup();
    expect(store.load).toHaveBeenCalledWith(run.id);
    expect(changes[0]).toMatchObject({
      id: run.id,
      status: 'REVIEW',
      configurations: ['Limited', 'XLT'],
      claims: 3,
      claimsWithIssues: 1,
    });
    expect(element.textContent).toContain('not requested: Raptor');
    expect(element.textContent).toContain('588.399 Nm');
    expect(element.textContent).toContain('Ambiguous source value');
  });

  it('opens shared research review with account access and no curator key input', async () => {
    const { fixture, store, element } = await setup();
    fixture.componentRef.setInput('runId', '');
    fixture.componentRef.setInput('researchId', 'private-request');
    await fixture.whenStable();
    expect(store.load).toHaveBeenLastCalledWith('', 'private-request');
    expect(element.querySelector('input[type="password"]')).toBeNull();
    expect(element.querySelector('[data-action="reject"]')).toBeNull();
    expect(element.textContent).toContain('588.399 Nm');
    expect(publishButton(element).disabled).toBe(true);
  });

  it('requires identity confirmation per configuration, one claim per attribute and a reason', async () => {
    const { fixture, store, element } = await setup();
    expect(publishButton(element).disabled).toBe(true);
    expect(claimBox(element, 2)).toBeNull();
    check(claimBox(element, 0), true);
    await fixture.whenStable();
    expect(claimBox(element, 0).checked).toBe(true);
    check(claimBox(element, 1), true);
    await fixture.whenStable();
    expect(claimBox(element, 0).checked).toBe(false);
    expect(claimBox(element, 1).checked).toBe(true);
    const reason = element.querySelector('textarea') as HTMLTextAreaElement;
    reason.value = 'Checked exact trim and year';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(publishButton(element).disabled).toBe(true);
    expect(
      element.querySelector('[data-role="unconfirmed"]')?.textContent,
    ).toContain('Limited');
    check(
      element.querySelector<HTMLInputElement>('[data-role="identity"]')!,
      true,
    );
    await fixture.whenStable();
    expect(publishButton(element).disabled).toBe(false);
    publishButton(element).click();
    await fixture.whenStable();
    expect(store.publish).toHaveBeenCalledWith({
      draftHash: run.draftHash,
      baseRevision: 4,
      reason: 'Checked exact trim and year',
      configurations: [
        { configuration: 0, identityConfirmed: true, selectedClaims: [1] },
      ],
    });
  });

  it('clears selections when the reviewed catalog version changes', async () => {
    const { fixture, store, element } = await setup();
    check(claimBox(element, 0), true);
    await fixture.whenStable();
    expect(claimBox(element, 0).checked).toBe(true);
    store.runValue.set({ ...structuredClone(run), baseRevision: 5 });
    await fixture.whenStable();
    expect(claimBox(element, 0).checked).toBe(false);
  });

  it('asks for the curator key before reading a run', async () => {
    const store = fakeStore();
    store.hasKey.set(false);
    await TestBed.configureTestingModule({
      imports: [VehicleIngestionRunDetail],
      providers: [provideRouter([])],
    })
      .overrideComponent(VehicleIngestionRunDetail, {
        set: {
          providers: [{ provide: IngestionDetailStore, useValue: store }],
        },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(VehicleIngestionRunDetail);
    fixture.componentRef.setInput('runId', run.id);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>(
      'input[type="password"]',
    )!;
    input.value = 'k'.repeat(40);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    element.querySelector('form')!.requestSubmit();
    await fixture.whenStable();
    expect(store.setKey).toHaveBeenCalledWith('k'.repeat(40));
  });
});
