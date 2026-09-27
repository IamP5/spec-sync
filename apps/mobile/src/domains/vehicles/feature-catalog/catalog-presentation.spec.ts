import type {
  CatalogPage,
  Comparison,
  VehicleConfiguration,
} from '../data/vehicle-contracts';
import {
  appendCatalogPages,
  catalogFact,
  catalogView,
  defaultCatalogLayout,
  filterAndSortConfigurations,
  identityLabel,
  MAX_SHORTLIST,
  modelSummaries,
  sortMode,
  toggleShortlist,
} from './catalog-presentation';

const ids = [
  '08e08761-a2e7-5ae5-b2ad-387e93829fb7',
  'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
  '1c5f0a50-4c1e-5d8e-9a0e-0d6a2b7c9e11',
  '2d6f1b61-5d2f-5e9f-8b1f-1e7b3c8d0f22',
  '3e7a2c72-6e3a-5fa0-9c2a-2f8c4d9e1a33',
  '4f8b3d83-7f4b-5ab1-8d3b-3a9d5eaf2b44',
] as const;

function vehicle(
  index: number,
  model = 'Ranger',
  name = `Trim ${index}`,
  identityStatus = 'CONFIRMED',
): VehicleConfiguration {
  return {
    id: ids[index] ?? ids[0],
    brand: model === 'Hilux' ? 'Toyota' : 'Ford',
    model,
    name,
    market: 'BR',
    modelYear: 2026,
    identityStatus,
    identityNote: null,
    identityEvidenceId: null,
  };
}

function numberCell(configurationId: string, value: number) {
  return {
    configurationId,
    knowledgeStatus: 'KNOWN' as const,
    reason: null,
    selectedObservationId: configurationId,
    observations: [
      {
        id: configurationId,
        value,
        availability: null,
        qualifiers: {},
        rawValue: null,
        reviewStatus: 'ACCEPTED',
        evidence: [],
      },
    ],
  };
}

function row(code: string, unit: string | null, cells: unknown[]) {
  return {
    attribute: {
      id: ids[0],
      code,
      label: code,
      description: null,
      valueType: 'NUMBER' as const,
      unit,
    },
    cells,
  } as Comparison['rows'][number];
}

const black = vehicle(0, 'Ranger', 'Black');
const limited = vehicle(1, 'Ranger', 'Limited');
const hilux = vehicle(2, 'Hilux', 'SRX', 'PROVISIONAL');
const summaries: Comparison = {
  configurations: [black, limited, hilux],
  rows: [
    row('reference_price', 'BRL', [
      numberCell(black.id, 242600),
      numberCell(hilux.id, 199000),
    ]),
    row('power_max', 'cv', [
      numberCell(black.id, 170),
      numberCell(limited.id, 250),
      {
        configurationId: hilux.id,
        knowledgeStatus: 'CONFLICTING',
        reason: null,
        selectedObservationId: null,
        observations: [],
      },
    ]),
  ],
};

describe('catalog presentation', () => {
  it('filters the loaded page by text and model family', () => {
    const all = [black, limited, hilux];
    expect(
      filterAndSortConfigurations(
        all,
        ' lim ',
        'all',
        'catalog-order',
        undefined,
      ),
    ).toEqual([limited]);
    expect(
      filterAndSortConfigurations(all, '', 'Hilux', 'catalog-order', undefined),
    ).toEqual([hilux]);
    expect(modelSummaries(all)).toEqual([
      { brand: 'Ford', model: 'Ranger', configurationCount: 2 },
      { brand: 'Toyota', model: 'Hilux', configurationCount: 1 },
    ]);
  });

  it('sorts known highlights before unknowns and keeps the catalog order on ties', () => {
    const all = [black, limited, hilux];
    expect(
      filterAndSortConfigurations(all, '', 'all', 'price-asc', summaries).map(
        ({ name }) => name,
      ),
    ).toEqual(['SRX', 'Black', 'Limited']);
    expect(
      filterAndSortConfigurations(all, '', 'all', 'power-desc', summaries).map(
        ({ name }) => name,
      ),
    ).toEqual(['Limited', 'Black', 'SRX']);
    expect(
      filterAndSortConfigurations(all, '', 'all', 'torque-desc', summaries),
    ).toEqual(all);
  });

  it('keeps unknown and conflicting facts explicit and formats prices in BRL', () => {
    expect(catalogFact(summaries, black.id, 'reference_price')).toMatchObject({
      text: 'R$242,600',
      numeric: 242600,
      status: 'known',
    });
    expect(catalogFact(summaries, black.id, 'power_max').text).toBe('170 cv');
    expect(catalogFact(summaries, limited.id, 'reference_price')).toEqual({
      text: 'Not reported',
      status: 'not-reported',
    });
    expect(catalogFact(summaries, hilux.id, 'power_max')).toEqual({
      text: 'Conflicting',
      status: 'conflicting',
    });
    expect(catalogFact(undefined, black.id, 'power_max').status).toBe(
      'not-reported',
    );
  });

  it('labels unconfirmed identities and parses sort modes defensively', () => {
    expect(identityLabel(black)).toBe('');
    expect(identityLabel(hilux)).toBe('Provisional');
    expect(identityLabel(vehicle(3, 'Ranger', 'XL', 'FROM_NOTES'))).toBe(
      'From notes',
    );
    expect(sortMode('power-desc')).toBe('power-desc');
    expect(sortMode('anything')).toBe('catalog-order');
  });

  it('opens large pages as a list', () => {
    expect(defaultCatalogLayout(8)).toBe('strip');
    expect(defaultCatalogLayout(9)).toBe('list');
  });

  it('caps the comparison shortlist', () => {
    const five = [0, 1, 2, 3, 4].map((index) => vehicle(index));
    expect(toggleShortlist(five, vehicle(5))).toEqual({
      kind: 'full',
      message: `Choose up to ${MAX_SHORTLIST} configurations for one comparison.`,
    });
    expect(toggleShortlist(five, five[0] ?? black)).toEqual({
      kind: 'changed',
      selected: five.slice(1),
    });
    expect(toggleShortlist([], black)).toEqual({
      kind: 'changed',
      selected: [black],
    });
  });

  it('appends continuation pages without repeating vehicles and continues each search', () => {
    const raptor = vehicle(3, 'Ranger', 'Raptor');
    const srx = vehicle(4, 'Hilux', 'SRX');
    const result = appendCatalogPages(
      [black.id, limited.id],
      [
        {
          search: { q: 'Ranger', market: 'BR', limit: 20, offset: 8 },
          page: {
            items: [limited, raptor],
            limit: 20,
            offset: 8,
            hasMore: false,
          },
        },
        {
          search: { q: 'Hilux', modelYear: 2026, limit: 6, offset: 2 },
          page: { items: [srx], limit: 6, offset: 2, hasMore: true },
        },
      ],
    );
    expect(result.appended).toEqual([raptor, srx]);
    expect(result.nextSearches).toEqual([
      { q: 'Hilux', modelYear: 2026, limit: 6, offset: 3 },
    ]);
  });

  it('describes the grown catalog and the paging that remains', () => {
    const page: CatalogPage = {
      items: [black],
      limit: 26,
      offset: 0,
      hasMore: true,
    };
    const view = catalogView(
      page,
      [black, limited],
      [{ q: 'Hilux', limit: 6, offset: 3 }],
    );
    expect(view).toMatchObject({
      items: [black, limited],
      hasMore: true,
      limit: 6,
    });
    expect(catalogView(page, [black], [])).toMatchObject({
      hasMore: false,
      limit: 26,
    });
  });
});
