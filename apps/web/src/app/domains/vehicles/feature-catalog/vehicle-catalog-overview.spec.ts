import { BreakpointObserver, type BreakpointState } from '@angular/cdk/layout';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { vehiclePhoto } from '../../../testing/vehicle-fixtures';
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
    nextPage = undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL | Request) => {
        const url = String(input);
        const body = url.includes('/api/vehicle-configurations')
          ? nextPage
          : url.includes('/api/vehicle-specifications')
            ? detail
            : summary;
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: body ? 200 : 503,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }),
    );
    await TestBed.configureTestingModule({
      imports: [VehicleCatalogOverview],
      providers: [
        provideHttpClient(),
        { provide: BreakpointObserver, useValue: { observe: () => screen } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleCatalogOverview);
    fixture.componentRef.setInput('page', {
      items: configurations,
      limit: 20,
      offset: 0,
      hasMore: true,
      nextSearches: [{ q: '', limit: 20, offset: 3 }],
    });
    fixture.componentRef.setInput('complete', true);
    fixture.componentInstance.questionRequested.subscribe(draft);
    fixture.componentInstance.comparisonRequested.subscribe(send);
    await fixture.whenStable();
    draft.mockReset();
    send.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads photos for a saved catalog and places the detail photo behind the name', async () => {
    const recorded = JSON.stringify(configurations);
    const element = fixture.nativeElement as HTMLElement;
    expect(
      element.querySelectorAll('app-vehicle-catalog-strip img'),
    ).toHaveLength(3);
    element
      .querySelector<HTMLButtonElement>('[aria-label="Show as list"]')
      ?.click();
    await fixture.whenStable();
    expect(
      element.querySelectorAll('app-vehicle-catalog-list img'),
    ).toHaveLength(3);
    element
      .querySelector<HTMLButtonElement>(
        '[aria-label="Open Ford Ranger Black details"]',
      )
      ?.click();
    await fixture.whenStable();
    const pane = document.querySelector('app-vehicle-detail-pane');
    expect(pane?.querySelector('header img')?.getAttribute('src')).toBe(
      vehiclePhoto.url,
    );
    expect(pane?.querySelectorAll('img')).toHaveLength(1);
    expect(pane?.querySelector('header')?.textContent).toContain('Ranger');
    expect(JSON.stringify(configurations)).toBe(recorded);
  });

  it('opens a small page as a card strip and lets the reader switch to the list', async () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-vehicle-catalog-strip')).not.toBeNull();
    expect(element.querySelector('app-vehicle-catalog-list')).toBeNull();
    expect(rows(element)).toHaveLength(3);

    const list = element.querySelector<HTMLButtonElement>(
      '[aria-label="Show as list"]',
    )!;
    list.click();
    await fixture.whenStable();
    expect(list.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('app-vehicle-catalog-strip')).toBeNull();
    expect(element.querySelector('app-vehicle-catalog-list')).not.toBeNull();
    expect(rows(element).map((row) => row.dataset['configurationId'])).toEqual([
      BLACK_ID,
      LIMITED_ID,
      HILUX_ID,
    ]);
  });

  it('opens a large page as a list, reveals it in steps and grows with the next page', async () => {
    const large = TestBed.createComponent(VehicleCatalogOverview);
    const items = Array.from({ length: 9 }, (_, index) =>
      configuration(crypto.randomUUID(), 'Ford', 'Ranger', `Trim ${index}`),
    );
    large.componentRef.setInput('page', {
      items,
      limit: 20,
      offset: 0,
      hasMore: true,
      nextSearches: [{ q: '', limit: 20, offset: 9 }],
    });
    const questions = vi.fn();
    large.componentInstance.questionRequested.subscribe(questions);
    await large.whenStable();
    const element = large.nativeElement as HTMLElement;
    expect(element.querySelector('app-vehicle-catalog-list')).not.toBeNull();
    expect(rows(element)).toHaveLength(4);
    expect(element.textContent).toContain('showing 4 of 9 loaded');
    expect(element.textContent).toContain('more in the catalog');
    expect(element.textContent).not.toContain('Load next');

    buttonNamed(element, 'Show 4 more').click();
    await large.whenStable();
    expect(rows(element)).toHaveLength(8);
    expect(element.textContent).not.toContain('Load next');
    buttonNamed(element, 'Show 1 more').click();
    await large.whenStable();
    expect(rows(element)).toHaveLength(9);
    expect(rows(element).map((row) => row.dataset['configurationId'])).toEqual(
      items.map(({ id }) => id),
    );

    const loaded = [
      configuration(crypto.randomUUID(), 'Ford', 'Ranger', 'Trim 9'),
      configuration(crypto.randomUUID(), 'Ford', 'Ranger', 'Trim 10'),
    ];
    nextPage = { items: loaded, limit: 20, offset: 9, hasMore: false };
    buttonNamed(element, 'Load next 20 from the catalog').click();
    await large.whenStable();
    await large.whenStable();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.map(([input]) => String(input))
        .filter((url) => url.includes('/api/vehicle-configurations'))
        .map((url) => url.slice(url.indexOf('/api/'))),
    ).toEqual(['/api/vehicle-configurations?q=&limit=20&offset=9']);
    expect(questions).not.toHaveBeenCalled();
    // The loaded configurations are revealed, not hidden behind "show more".
    expect(rows(element)).toHaveLength(11);
    expect(rows(element).map((row) => row.dataset['configurationId'])).toEqual(
      [...items, ...loaded].map(({ id }) => id),
    );
    expect(element.textContent).toContain('showing 11 of 11 loaded');
    expect(element.textContent).not.toContain('Load next');

    buttonNamed(element, 'Show less').click();
    await large.whenStable();
    expect(rows(element)).toHaveLength(4);
    large.destroy();
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
    expect(element.textContent).toContain('showing 3 of 3 loaded');
    expect(element.textContent).toContain('more in the catalog');

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
    expect(element.textContent).toContain('showing 1 of 1 loaded');

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

  it('selecting a model family narrows the page and selecting it again clears it', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const ranger = buttonNamed(element, 'Ranger');
    ranger.click();
    await fixture.whenStable();
    expect(rows(element)).toHaveLength(2);
    expect(ranger.getAttribute('aria-pressed')).toBe('true');
    expect(buttonNamed(element, 'All').getAttribute('aria-pressed')).toBe(
      'false',
    );

    ranger.click();
    await fixture.whenStable();
    expect(rows(element)).toHaveLength(3);
    expect(ranger.getAttribute('aria-pressed')).toBe('false');
    expect(buttonNamed(element, 'All').getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('compares only the explicit shortlist through the current conversation', async () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Add two or more to compare');
    element
      .querySelector<HTMLButtonElement>('[data-action="add-shortlist"]')
      ?.click();
    await fixture.whenStable();
    const compare = element.querySelector<HTMLButtonElement>(
      '[data-action="compare-shortlist"]',
    )!;
    expect(compare.disabled).toBe(true);
    element
      .querySelector<HTMLButtonElement>('[data-action="add-shortlist"]')
      ?.click();
    await fixture.whenStable();
    expect(element.textContent).toContain(
      '2 selected · Ranger Black, Ranger Limited',
    );
    expect(compare.disabled).toBe(false);
    compare.click();

    expect(send).toHaveBeenCalledOnce();
    expect(
      send.mock.calls[0]?.[0].map((vehicle: { id: string }) => vehicle.id),
    ).toEqual([BLACK_ID, LIMITED_ID]);
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
/** The catalog page the API answers a continuation query with; undefined fails the request. */
let nextPage: unknown;
const LIMITED_ID = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
const HILUX_ID = 'c28c64e4-801a-5d29-b4c2-083a888a79f3';

const configurations = [
  configuration(BLACK_ID, 'Ford', 'Ranger', 'Black'),
  configuration(LIMITED_ID, 'Ford', 'Ranger', 'Limited'),
  configuration(HILUX_ID, 'Toyota', 'Hilux', 'SRX Plus'),
];

const summary: Comparison = {
  configurations: configurations.map((vehicle) => ({
    ...vehicle,
    primaryImage: vehiclePhoto,
  })),
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
  configurations: [{ ...configurations[0], primaryImage: vehiclePhoto }],
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
