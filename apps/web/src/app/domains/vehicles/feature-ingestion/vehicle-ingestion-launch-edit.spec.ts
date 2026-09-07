import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { IngestionDetailStore } from './ingestion-detail-store';
import {
  parseConfigurationNames,
  VehicleIngestionLaunchEdit,
} from './vehicle-ingestion-launch-edit';

describe('Vehicle ingestion launch', () => {
  function fakeStore(hasKey: boolean) {
    return {
      hasKey: signal(hasKey),
      createIsPending: signal(false),
      createError: signal(undefined),
      setKey: vi.fn(),
      create: vi.fn().mockResolvedValue({
        status: 'success',
        value: { id: 'run-1', status: 'QUEUED', request: {} },
      }),
    };
  }
  async function setup(hasKey: boolean) {
    const store = fakeStore(hasKey);
    await TestBed.configureTestingModule({
      imports: [VehicleIngestionLaunchEdit],
    })
      .overrideComponent(VehicleIngestionLaunchEdit, {
        set: {
          providers: [{ provide: IngestionDetailStore, useValue: store }],
        },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(VehicleIngestionLaunchEdit);
    fixture.componentRef.setInput('prefill', {
      sourceUrl: 'https://www.ford.com.br/ranger.pdf',
      brand: 'Ford',
      model: 'Ranger',
      modelYear: 2026,
      configurations: ['Limited 3.0 V6', 'XLT 2.0'],
    });
    const started: unknown[] = [];
    fixture.componentInstance.started.subscribe((run) => started.push(run));
    await fixture.whenStable();
    return {
      fixture,
      store,
      started,
      element: fixture.nativeElement as HTMLElement,
    };
  }
  const type = (
    input: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('parses one configuration per line without duplicates', () => {
    expect(parseConfigurationNames(' Limited \n\nxlt\nXLT\n')).toEqual([
      'Limited',
      'xlt',
    ]);
  });

  it('starts a prefilled run with the parsed configurations once the session has a key', async () => {
    const { fixture, store, started, element } = await setup(true);
    expect(element.querySelector('input[type="password"]')).toBeNull();
    expect(
      element.querySelector('[data-role="configuration-count"]')?.textContent,
    ).toContain('2 of 8');
    const start = element.querySelector<HTMLButtonElement>(
      '[data-action="start"]',
    )!;
    expect(start.disabled).toBe(false);
    start.click();
    await fixture.whenStable();
    expect(store.create).toHaveBeenCalledWith({
      id: expect.any(String),
      request: {
        sourceUrl: 'https://www.ford.com.br/ranger.pdf',
        brand: 'Ford',
        model: 'Ranger',
        market: 'BR',
        modelYear: 2026,
        configurations: ['Limited 3.0 V6', 'XLT 2.0'],
      },
    });
    expect(started).toHaveLength(1);
  });

  it('requires the curator key when the session has none and stores it before creating', async () => {
    const { fixture, store, element } = await setup(false);
    const start = element.querySelector<HTMLButtonElement>(
      '[data-action="start"]',
    )!;
    expect(start.disabled).toBe(true);
    type(
      element.querySelector<HTMLInputElement>('input[type="password"]')!,
      'k'.repeat(40),
    );
    type(element.querySelector('textarea')!, '');
    await fixture.whenStable();
    expect(start.disabled).toBe(false);
    start.click();
    await fixture.whenStable();
    expect(store.setKey).toHaveBeenCalledWith('k'.repeat(40));
    expect(store.create.mock.calls[0][0].request.configurations).toEqual([]);
  });

  it('keeps the typed key and edits when an equivalent prefill is set again', async () => {
    const { fixture, element } = await setup(false);
    const key = element.querySelector<HTMLInputElement>(
      'input[type="password"]',
    )!;
    type(key, 'k'.repeat(64));
    type(
      element.querySelector<HTMLInputElement>('input[placeholder="Ranger"]')!,
      'Ranger Raptor',
    );
    await fixture.whenStable();
    const start = element.querySelector<HTMLButtonElement>(
      '[data-action="start"]',
    )!;
    expect(start.disabled).toBe(false);
    // Chat cards re-emit a structurally equal prefill on every agent event.
    fixture.componentRef.setInput('prefill', {
      sourceUrl: 'https://www.ford.com.br/ranger.pdf',
      brand: 'Ford',
      model: 'Ranger',
      modelYear: 2026,
      configurations: ['Limited 3.0 V6', 'XLT 2.0'],
    });
    await fixture.whenStable();
    expect(start.disabled).toBe(false);
    expect(
      element.querySelector<HTMLInputElement>('input[placeholder="Ranger"]')!
        .value,
    ).toBe('Ranger Raptor');
    // A different prefill still resets the form.
    fixture.componentRef.setInput('prefill', {
      brand: 'Toyota',
      model: 'Hilux',
      modelYear: 2026,
    });
    await fixture.whenStable();
    expect(
      element.querySelector<HTMLInputElement>('input[placeholder="Ranger"]')!
        .value,
    ).toBe('Hilux');
    expect(start.disabled).toBe(true);
  });
});
