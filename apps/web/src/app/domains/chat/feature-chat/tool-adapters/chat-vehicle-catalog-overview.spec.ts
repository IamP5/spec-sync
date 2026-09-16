import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { Comparison } from '../../../vehicles/api/contracts';
import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import { ChatVehicleCatalogOverview } from './chat-vehicle-catalog-overview';

describe('ChatVehicleCatalogOverview', () => {
  let fixture: ComponentFixture<ChatVehicleCatalogOverview>;
  const draft = vi.fn();
  const send = vi.fn();

  beforeEach(async () => {
    nextPages = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL | Request) => {
        const url = String(input);
        const body = url.includes('/api/vehicle-configurations')
          ? nextPages(url)
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
      imports: [ChatVehicleCatalogOverview],
      providers: [
        provideHttpClient(),
        { provide: CHAT_CARD_ACTIONS, useValue: { draft, send } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatVehicleCatalogOverview);
    fixture.componentRef.setInput('toolCall', {
      name: 'searchVehicleConfigurations',
      args: { q: '' },
      status: 'complete',
      result: JSON.stringify({
        items: configurations,
        limit: 20,
        offset: 0,
        hasMore: true,
      }),
    });
    await fixture.whenStable();
    draft.mockReset();
    send.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

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

    ranger.click();
    await fixture.whenStable();
    expect(rows(element)).toHaveLength(3);
    expect(ranger.getAttribute('aria-pressed')).toBe('false');
  });

  it('loads the next page of a recorded search into the same catalog without asking the agent', async () => {
    nextPages = () => ({
      items: [configuration(MAVERICK_ID, 'Ford', 'Maverick', 'Lariat')],
      limit: 20,
      offset: 3,
      hasMore: false,
    });
    const element = fixture.nativeElement as HTMLElement;
    buttonNamed(element, 'Load next 20 from the catalog').click();
    await fixture.whenStable();
    await fixture.whenStable();

    expect(catalogRequests()).toEqual([
      '/api/vehicle-configurations?q=&limit=20&offset=3',
    ]);
    expect(
      element.querySelectorAll('app-vehicle-catalog-overview'),
    ).toHaveLength(1);
    expect(rows(element).map((row) => row.dataset['configurationId'])).toEqual([
      BLACK_ID,
      LIMITED_ID,
      HILUX_ID,
      MAVERICK_ID,
    ]);
    expect(element.textContent).toContain('showing 4 of 4 loaded');
    expect(element.textContent).not.toContain('more in the catalog');
    expect(element.textContent).not.toContain('Load next');
    expect(send).not.toHaveBeenCalled();
    expect(draft).not.toHaveBeenCalled();
  });

  it('continues every server-provided search in place, merging vehicles and paging until exhausted', async () => {
    const nextSearches = [
      { q: 'Ranger', market: 'BR', offset: 8, limit: 20 },
      { q: 'Hilux', modelYear: 2026, offset: 2, limit: 6 },
    ];
    fixture.componentRef.setInput('toolCall', {
      name: 'searchVehicleConfigurations',
      status: 'complete',
      args: { searches: [{ q: 'Ranger' }, { q: 'Hilux' }] },
      result: JSON.stringify({
        items: configurations,
        limit: 26,
        offset: 0,
        hasMore: true,
        status: 'OK',
        notices: [],
        nextSearches,
      }),
    });
    await fixture.whenStable();
    nextPages = (url) =>
      url.includes('q=Ranger')
        ? {
            // An already listed configuration is not repeated.
            items: [
              configuration(LIMITED_ID, 'Ford', 'Ranger', 'Limited'),
              configuration(MAVERICK_ID, 'Ford', 'Ranger', 'Raptor'),
            ],
            limit: 20,
            offset: 8,
            hasMore: false,
          }
        : {
            items: [configuration(SRX_ID, 'Toyota', 'Hilux', 'SRX')],
            limit: 6,
            offset: 2,
            hasMore: true,
          };
    const element = fixture.nativeElement as HTMLElement;
    buttonNamed(element, 'Load next 26 from the catalog').click();
    await fixture.whenStable();
    await fixture.whenStable();

    expect(catalogRequests()).toEqual([
      '/api/vehicle-configurations?q=Ranger&limit=20&offset=8&market=BR',
      '/api/vehicle-configurations?q=Hilux&limit=6&offset=2&modelYear=2026',
    ]);
    expect(rows(element).map((row) => row.dataset['configurationId'])).toEqual([
      BLACK_ID,
      LIMITED_ID,
      HILUX_ID,
      MAVERICK_ID,
      SRX_ID,
    ]);
    expect(element.textContent).toContain('more in the catalog');

    buttonNamed(element, 'Load next 6 from the catalog').click();
    await fixture.whenStable();
    await fixture.whenStable();
    expect(catalogRequests()).toHaveLength(3);
    expect(catalogRequests()[2]).toBe(
      '/api/vehicle-configurations?q=Hilux&limit=6&offset=3&modelYear=2026',
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('reports a failed next page and keeps the loaded catalog', async () => {
    const element = fixture.nativeElement as HTMLElement;
    buttonNamed(element, 'Load next 20 from the catalog').click();
    await fixture.whenStable();
    await fixture.whenStable();

    expect(element.textContent).toContain(
      'Could not load more of the catalog.',
    );
    expect(rows(element)).toHaveLength(3);
    expect(buttonNamed(element, 'Load next 20 from the catalog').disabled).toBe(
      false,
    );
  });

  it('shows explicit partial failures even when successful searches returned no vehicles', async () => {
    fixture.componentRef.setInput('toolCall', {
      name: 'searchVehicleConfigurations',
      status: 'complete',
      args: { searches: [{ q: 'Shark' }, { q: 'Ranger' }] },
      result: JSON.stringify({
        items: [],
        limit: 40,
        offset: 0,
        hasMore: false,
        status: 'PARTIAL',
        nextSearches: [],
        notices: [
          'No configurations found for Shark.',
          'Ranger: Catalog request failed (503).',
        ],
      }),
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'Ranger: Catalog request failed (503).',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'No configurations found for this search',
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

    element
      .querySelector<HTMLButtonElement>('[data-action="compare-shortlist"]')
      ?.click();

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toContain(BLACK_ID);
    expect(send.mock.calls[0]?.[0]).toContain(LIMITED_ID);
  });

  it('opens sourced specifications in a motion drawer and returns an editable draft to the composer', async () => {
    const element = fixture.nativeElement as HTMLElement;
    element
      .querySelector<HTMLButtonElement>(
        '[aria-label="Open Ford Ranger Black details"]',
      )
      ?.click();
    await fixture.whenStable();
    const overlay = document.querySelector<HTMLElement>(
      '.cdk-overlay-container',
    );
    const drawer = overlay?.querySelector<HTMLElement>('z-drawer-panel');
    expect(drawer?.dataset['placement']).toBe('right');
    expect(drawer?.classList.contains('will-change-transform')).toBe(true);
    expect(drawer?.style.getPropertyValue('--z-drawer-duration')).toBe('450ms');
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
    expect(draft).toHaveBeenCalledWith(expect.stringContaining(BLACK_ID));
    expect(overlay?.querySelector('z-drawer-panel')).toBeNull();
  });
});

const BLACK_ID = '08e08761-a2e7-5ae5-b2ad-387e93829fb7';
const MAVERICK_ID = '3c0fdb61-1a4e-5a1c-9c2c-6f8f2a7f0a11';
const SRX_ID = '9d1c2b3a-4e5f-5a6b-8c7d-0e1f2a3b4c5d';
/** The catalog page the API answers a continuation query with; undefined fails the request. */
let nextPages: (url: string) => unknown = () => undefined;

function catalogRequests(): string[] {
  return vi
    .mocked(fetch)
    .mock.calls.map(([input]) => String(input))
    .filter((url) => url.includes('/api/vehicle-configurations'))
    .map((url) => url.slice(url.indexOf('/api/')));
}
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
