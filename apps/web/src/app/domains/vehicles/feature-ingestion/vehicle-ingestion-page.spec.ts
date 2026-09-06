import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { IngestionRun } from '../data/ingestion-contracts';
import { IngestionDetailStore } from './ingestion-detail-store';
import { VehicleIngestionPage } from './vehicle-ingestion-page';

const run: IngestionRun = {
  id: '00000000-0000-4000-8000-000000000001',
  request: {
    sourceUrl: 'https://www.ford.com.br/specs',
    brand: 'Ford',
    model: 'Ranger',
    name: 'Test',
    market: 'BR',
    modelYear: 2026,
  },
  status: 'REVIEW',
  attempts: 1,
  draftHash: 'a'.repeat(64),
  baseRevision: 4,
  configurationId: null,
  error: null,
  projectionStatus: 'NOT_REQUESTED',
  projectionError: null,
  currentValues: {},
  draft: {
    source: {
      url: 'https://www.ford.com.br/specs',
      title: 'Manufacturer brochure',
      text: 'Ranger Test 2026\n60 kgf.m',
      textSha256: 'b'.repeat(64),
      parserVersion: 'test',
    },
    identityLineStart: 1,
    identityLineEnd: 1,
    identityExcerpt: 'Ranger Test 2026',
    claims: [
      {
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
        issues: [],
      },
      {
        attributeCode: 'payload',
        label: 'Payload',
        unit: 'kg',
        rawValue: '—',
        rawUnit: 'kg',
        availability: null,
        listValue: null,
        qualifiers: {},
        lineStart: 3,
        lineEnd: 3,
        excerpt: '—',
        locator: 'Page 1',
        value: null,
        issues: ['Ambiguous source value'],
      },
    ],
  },
};

describe('Vehicle ingestion review', () => {
  function fakeStore() {
    return {
      runValue: signal<IngestionRun | undefined>(structuredClone(run)),
      id: signal(run.id),
      runError: signal(undefined),
      createError: signal(undefined),
      publishError: signal(undefined),
      rejectError: signal(undefined),
      downloadSourceIsPending: signal(false),
      downloadSourceError: signal(null),
      downloadSource: vi.fn(),
      createIsPending: signal(false),
      publishIsPending: signal(false),
      rejectIsPending: signal(false),
      connect: vi.fn(),
      reload: vi.fn(),
      publish: vi.fn().mockResolvedValue({ status: 'success', value: run }),
      reject: vi.fn(),
      create: vi.fn(),
    };
  }
  async function setup() {
    const store = fakeStore();
    await TestBed.configureTestingModule({
      imports: [VehicleIngestionPage],
      providers: [provideRouter([])],
    })
      .overrideComponent(VehicleIngestionPage, {
        set: {
          providers: [{ provide: IngestionDetailStore, useValue: store }],
        },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(VehicleIngestionPage);
    fixture.componentRef.setInput('runId', run.id);
    await fixture.whenStable();
    return { fixture, store, element: fixture.nativeElement as HTMLElement };
  }
  it('requires identity confirmation, claim selection and a review reason before publication', async () => {
    const { fixture, store, element } = await setup();
    const publish = Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Publish selected'),
    ) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    expect(element.textContent).toContain('588.399');
    expect(element.textContent).toContain('Nm');
    expect(element.textContent).toContain('Ambiguous source value');
    const boxes = element.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(boxes.length).toBe(2);
    for (const box of boxes) {
      box.checked = true;
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const reason = element.querySelector('textarea') as HTMLTextAreaElement;
    reason.value = 'Checked exact trim and year';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(publish.disabled).toBe(false);
    publish.click();
    await fixture.whenStable();
    expect(store.publish).toHaveBeenCalledWith({
      draftHash: run.draftHash,
      baseRevision: 4,
      selectedClaims: [0],
      identityConfirmed: true,
      reason: 'Checked exact trim and year',
    });
  });
  it('clears selections when the reviewed catalog version changes', async () => {
    const { fixture, store, element } = await setup();
    const boxes = element.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    for (const box of boxes) {
      box.checked = true;
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
    store.runValue.set({ ...run, baseRevision: 5 });
    await fixture.whenStable();
    expect(
      Array.from(
        element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      ).every((box) => !box.checked),
    ).toBe(true);
  });
});
