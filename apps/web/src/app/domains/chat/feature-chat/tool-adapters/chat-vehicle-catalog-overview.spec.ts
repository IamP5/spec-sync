import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { Comparison } from '../../../vehicles/api/contracts';
import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import { ChatVehicleCatalogOverview } from './chat-vehicle-catalog-overview';

describe('ChatVehicleCatalogOverview', () => {
  let fixture: ComponentFixture<ChatVehicleCatalogOverview>;
  const draft = vi.fn();
  const send = vi.fn();

  beforeEach(async () => {
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
      imports: [ChatVehicleCatalogOverview],
      providers: [{ provide: CHAT_CARD_ACTIONS, useValue: { draft, send } }],
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
    expect(send.mock.calls[0]?.[0]).toContain(BLACK_ID);
    expect(send.mock.calls[0]?.[0]).toContain(LIMITED_ID);
    expect(element.textContent).toContain('No segment label is claimed');
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
    expect(drawer?.style.getPropertyValue('--z-drawer-duration')).toBe('260ms');
    expect(overlay?.textContent).toContain('Overview');
    expect(overlay?.textContent).toContain('Catalog confidence');
    expect(overlay?.textContent).toContain('Black');

    overlay
      ?.querySelector<HTMLButtonElement>('[data-action="ask-about-vehicle"]')
      ?.click();
    await fixture.whenStable();
    expect(drawer?.dataset['state']).toBe('closed');

    await new Promise((resolve) => setTimeout(resolve, 280));
    expect(draft).toHaveBeenCalledWith(expect.stringContaining(BLACK_ID));
    expect(overlay?.querySelector('z-drawer-panel')).toBeNull();
  });
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
