import { BreakpointObserver, type BreakpointState } from '@angular/cdk/layout';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import type { Comparison } from '../data/vehicle-contracts';
import { VehicleCatalogOverview } from './vehicle-catalog-overview';

describe('VehicleCatalogOverview', () => {
  let fixture: ComponentFixture<VehicleCatalogOverview>;
  const draft = vi.fn();
  const send = vi.fn();
  let screen: BehaviorSubject<BreakpointState>;

  beforeEach(async () => {
    screen = new BehaviorSubject<BreakpointState>({
      matches: false,
      breakpoints: {},
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL | Request) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              String(input).includes('/api/vehicle-specifications')
                ? detail
                : summary,
            ),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        ),
      ),
    );
    await TestBed.configureTestingModule({
      imports: [VehicleCatalogOverview],
      providers: [
        { provide: BreakpointObserver, useValue: { observe: () => screen } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleCatalogOverview);
    fixture.componentRef.setInput('page', {
      items: configurations,
      limit: 20,
      offset: 0,
      hasMore: true,
    });
    fixture.componentRef.setInput('complete', true);
    fixture.componentInstance.questionRequested.subscribe(draft);
    fixture.componentInstance.comparisonRequested.subscribe(send);
    await fixture.whenStable();
    draft.mockReset();
    send.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('keeps a selected model active when mobile filters are collapsed', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const toggle = buttonNamed(element, 'Filters');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const controlledIds =
      toggle.getAttribute('aria-controls')?.split(' ') ?? [];
    expect(controlledIds).toHaveLength(2);
    for (const id of controlledIds) {
      expect(element.querySelector(`[id="${id}"]`)).not.toBeNull();
    }

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    buttonNamed(element, 'Hilux').click();
    await fixture.whenStable();
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(rows(element).map((row) => row.dataset['configurationId'])).toEqual([
      HILUX_ID,
    ]);
    expect(toggle.textContent).toContain('(2)');

    buttonNamed(element, 'Clear filters').click();
    await fixture.whenStable();
    expect(rows(element)).toHaveLength(3);
  });

  it('isolates filters and shortlists for multiple rendered catalogs', async () => {
    const second = TestBed.createComponent(VehicleCatalogOverview);
    second.componentRef.setInput('page', {
      items: configurations,
      limit: 20,
      offset: 0,
      hasMore: false,
    });
    const compared = vi.fn();
    second.componentInstance.comparisonRequested.subscribe(compared);
    await second.whenStable();
    const firstElement = fixture.nativeElement as HTMLElement;
    const secondElement = second.nativeElement as HTMLElement;
    firstElement
      .querySelector<HTMLButtonElement>('[data-action="add-shortlist"]')
      ?.click();
    await fixture.whenStable();
    expect(
      secondElement.querySelectorAll('[data-action="add-shortlist"]'),
    ).toHaveLength(3);
    const controls = [firstElement, secondElement].flatMap((element) => [
      ...element.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        '[data-catalog-search], [data-catalog-sort]',
      ),
    ]);
    expect(new Set(controls.map((control) => control.id)).size).toBe(4);
    for (const control of controls) expect(control.labels).toHaveLength(1);
    const search = firstElement.querySelector<HTMLInputElement>(
      'input[type="search"]',
    );
    if (!search) throw new Error('Catalog search missing');
    search.value = 'Hilux';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(rows(firstElement)).toHaveLength(1);
    expect(rows(secondElement)).toHaveLength(3);
    expect(compared).not.toHaveBeenCalled();
    second.destroy();
  });

  it('cancels pending highlight requests when its catalog is destroyed', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = options.signal;
            if (!signal) throw new Error('Missing cancellation signal');
            signals.push(signal);
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          }),
      ),
    );
    const pending = TestBed.createComponent(VehicleCatalogOverview);
    pending.componentRef.setInput('page', {
      items: configurations,
      limit: 20,
      offset: 0,
      hasMore: false,
    });
    TestBed.tick();
    await Promise.resolve();
    expect(signals.length).toBeGreaterThan(0);
    pending.destroy();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('filters the loaded page and sorts known highlights before unknowns', async () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(rows(element)).toHaveLength(3);
    expect(element.textContent).toContain(
      '3 configurations shown on this page',
    );
    expect(element.textContent).toContain('more are available');

    const search = element.querySelector<HTMLInputElement>(
      '[data-catalog-search]',
    );
    if (!search) throw new Error('Catalog search input was not rendered');
    search.value = 'Hilux';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(rows(element).map((row) => row.dataset['configurationId'])).toEqual([
      HILUX_ID,
    ]);

    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const sort = element.querySelector<HTMLSelectElement>(
      '[data-catalog-sort]',
    );
    if (!sort) throw new Error('Catalog sort was not rendered');
    sort.value = 'power-desc';
    sort.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(rows(element).map((row) => row.dataset['configurationId'])).toEqual([
      LIMITED_ID,
      HILUX_ID,
      BLACK_ID,
    ]);

    sort.value = 'price-asc';
    sort.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    const sortedByPrice = rows(element);
    expect(
      sortedByPrice[sortedByPrice.length - 1]?.dataset['configurationId'],
    ).toBe(HILUX_ID);
  });

  it('selecting a model narrows its make and selecting it again clears the model', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const ranger = buttonNamed(element, 'Ranger');
    ranger.click();
    await fixture.whenStable();
    expect(rows(element)).toHaveLength(2);
    expect(buttonNamed(element, 'Ford').getAttribute('aria-pressed')).toBe(
      'true',
    );

    buttonNamed(element, 'Ranger').click();
    await fixture.whenStable();
    expect(rows(element)).toHaveLength(2);
    expect(buttonNamed(element, 'Ranger').getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('compares only the explicit shortlist through the current conversation', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const shortlistButtons = element.querySelectorAll<HTMLButtonElement>(
      '[data-action="add-shortlist"]',
    );
    shortlistButtons[0]?.click();
    await fixture.whenStable();
    element
      .querySelector<HTMLButtonElement>('[data-action="add-shortlist"]')
      ?.click();
    await fixture.whenStable();

    buttonNamed(element, 'Competitors').click();
    await fixture.whenStable();
    element
      .querySelector<HTMLButtonElement>('[data-action="compare-shortlist"]')
      ?.click();

    expect(send).toHaveBeenCalledOnce();
    expect(
      send.mock.calls[0]?.[0].map((vehicle: { id: string }) => vehicle.id),
    ).toContain(BLACK_ID);
    expect(
      send.mock.calls[0]?.[0].map((vehicle: { id: string }) => vehicle.id),
    ).toContain(LIMITED_ID);
    expect(element.textContent).toContain('No segment label is claimed');
  });

  it.each([false, true])(
    'opens responsive details and hands off after closing (mobile: %s)',
    async (mobile) => {
      screen.next({ matches: mobile, breakpoints: {} });
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const trigger = element.querySelector<HTMLButtonElement>(
        '[aria-label="Open Ford Ranger Black details"]',
      )!;
      trigger.focus();
      trigger.click();
      await fixture.whenStable();
      const overlay = document.querySelector<HTMLElement>(
        '.cdk-overlay-container',
      );
      const drawer = overlay?.querySelector<HTMLElement>('z-drawer-panel');
      expect(drawer?.dataset['placement']).toBe(mobile ? 'bottom' : 'right');
      expect(!!drawer?.querySelector('[data-slot=drawer-swipe-handle]')).toBe(
        mobile,
      );
      expect(drawer?.getAttribute('aria-labelledby')).toBeTruthy();
      expect(drawer?.classList.contains('will-change-transform')).toBe(true);
      expect(drawer?.style.getPropertyValue('--z-drawer-duration')).toBe(
        '450ms',
      );
      expect(overlay?.textContent).toContain('Overview');
      expect(overlay?.textContent).toContain('Catalog confidence');
      expect(overlay?.textContent).toContain('Black');

      overlay
        ?.querySelector<HTMLButtonElement>('[data-action="ask-about-vehicle"]')
        ?.click();
      await fixture.whenStable();
      expect(drawer?.dataset['state']).toBe('closed');

      expect(draft).not.toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fixture.whenStable();
      expect(document.activeElement).toBe(trigger);
      expect(draft).toHaveBeenCalledWith({
        kind: 'vehicle',
        vehicle: configurations[0],
      });
      expect(overlay?.querySelector('z-drawer-panel')).toBeNull();
    },
  );
});

const BLACK_ID = '08e08761-a2e7-5ae5-b2ad-387e93829fb7';
const LIMITED_ID = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
const HILUX_ID = 'c28c64e4-801a-5d29-b4c2-083a888a79f3';

const configurations = [
  configuration(BLACK_ID, 'Ford', 'Ranger', 'Black'),
  configuration(LIMITED_ID, 'Ford', 'Ranger', 'Limited'),
  configuration(HILUX_ID, 'Toyota', 'Hilux', 'SRX Plus'),
];

const summary: Comparison = {
  configurations,
  rows: [
    numericRow('power_max', 'Power', 'cv', [170, 250, 204]),
    numericRow('torque_max', 'Torque', 'Nm', [405, 600, 499]),
    numericRow('reference_price', 'Reference price', 'BRL', [
      242_600,
      346_900,
      undefined,
    ]),
    numericRow('payload', 'Payload', 'kg', [undefined, undefined, 1005]),
    availabilityRow('adaptive_cruise', [undefined, 'OPTIONAL', 'STANDARD']),
    availabilityRow('camera_360', [undefined, 'OPTIONAL', 'CONFLICTING']),
  ],
};

const detail: Comparison = {
  configurations: [configurations[0]],
  rows: summary.rows.map((row) => ({
    ...row,
    cells: [row.cells[0]],
  })),
};

function configuration(id: string, brand: string, model: string, name: string) {
  return {
    id,
    brand,
    model,
    name,
    market: 'BR',
    modelYear: 2026,
    identityStatus: 'CONFIRMED',
    identityNote: null,
    identityEvidenceId: null,
  };
}

function numericRow(
  code: string,
  label: string,
  unit: string,
  values: (number | undefined)[],
): Comparison['rows'][number] {
  return {
    attribute: {
      id: crypto.randomUUID(),
      code,
      label,
      description: null,
      valueType: 'NUMBER',
      unit,
    },
    cells: values.map((value, index) => cell(index, value)),
  };
}

function availabilityRow(
  code: string,
  values: (string | undefined)[],
): Comparison['rows'][number] {
  return {
    attribute: {
      id: crypto.randomUUID(),
      code,
      label: code,
      description: null,
      valueType: 'AVAILABILITY',
      unit: null,
    },
    cells: values.map((value, index) =>
      value === 'CONFLICTING'
        ? {
            ...cell(index, undefined),
            knowledgeStatus: 'CONFLICTING',
            reason: 'Sources disagree',
          }
        : cell(index, undefined, value),
    ),
  };
}

function cell(index: number, value?: number, availability?: string) {
  const observationId = crypto.randomUUID();
  return {
    configurationId: configurations[index].id,
    knowledgeStatus:
      value === undefined && !availability ? 'NOT_REPORTED' : 'KNOWN',
    reason: null,
    selectedObservationId:
      value === undefined && !availability ? null : observationId,
    observations:
      value === undefined && !availability
        ? []
        : [
            {
              id: observationId,
              value: value ?? null,
              availability: availability ?? null,
              qualifiers: {},
              rawValue: null,
              reviewStatus: 'ACCEPTED',
              evidence: [],
            },
          ],
  } as Comparison['rows'][number]['cells'][number];
}

function rows(element: HTMLElement): HTMLElement[] {
  return [...element.querySelectorAll<HTMLElement>('[data-configuration-id]')];
}

function buttonNamed(element: HTMLElement, name: string): HTMLButtonElement {
  const button = [
    ...element.querySelectorAll<HTMLButtonElement>('button'),
  ].find((candidate) => candidate.textContent?.includes(name));
  if (!button) throw new Error(`Button ${name} was not rendered`);
  return button;
}
