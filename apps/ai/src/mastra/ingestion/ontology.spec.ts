import { describe, expect, it } from 'vitest';

import { resolveTerm, type Terminology } from './ontology';

const ford = { brand: 'Ford', model: 'F-150', market: 'BR', modelYear: 2026 };
const term = (
  attributeCode: string,
  value: string,
  overrides: Partial<Terminology> = {},
): Terminology => ({
  attributeCode,
  term: value,
  brand: 'Ford',
  model: null,
  market: 'BR',
  language: 'pt-BR',
  modelYear: null,
  ...overrides,
});

describe('scoped ontology meaning resolution', () => {
  const terms = [
    term('payload', 'Capacidade de carga'),
    term('towing_capacity', 'Capacidade de reboque'),
    term('cargo_bed_volume', 'Capacidade da caçamba'),
    term('luggage_volume', 'Volume do porta-malas'),
    term('passenger_capacity', 'Número de passageiros'),
  ];

  it('normalizes case, accents and whitespace without equating competing physical meanings', () => {
    expect(resolveTerm(' CAPACIDADE  DA CACAMBA ', ford, terms)).toBe(
      'cargo_bed_volume',
    );
    expect(resolveTerm('Capacidade de reboque', ford, terms)).toBe(
      'towing_capacity',
    );
    expect(resolveTerm('Capacidade de carga', ford, terms)).toBe('payload');
    expect(resolveTerm('Volume do porta-malas', ford, terms)).toBe(
      'luggage_volume',
    );
    expect(resolveTerm('Capacidade', ford, terms)).toBeUndefined();
    expect(
      resolveTerm('Número de assentos incluindo motorista', ford, terms),
    ).toBeUndefined();
  });

  it('never promotes manufacturer, language, market, model or year mismatches to global aliases', () => {
    for (const overrides of [
      { brand: 'Toyota' },
      { model: 'Ranger' },
      { market: 'US' },
      { language: 'en' },
      { modelYear: 2025 },
    ]) {
      expect(
        resolveTerm('Pacote Tremor', ford, [
          term('off_road_package', 'Pacote Tremor', overrides),
        ]),
      ).toBeUndefined();
    }
    expect(
      resolveTerm('Pacote Tremor', ford, [
        term('off_road_package', 'Pacote Tremor'),
      ]),
    ).toBe('off_road_package');
    expect(
      resolveTerm('Diferencial blocante', ford, [
        term('off_road_package', 'Pacote Tremor'),
      ]),
    ).toBeUndefined();
  });

  it('fails closed for conflicting mappings, including generic aliases', () => {
    expect(
      resolveTerm('Capacidade', ford, [
        term('payload', 'Capacidade'),
        term('towing_capacity', 'Capacidade', { brand: null }),
      ]),
    ).toBeUndefined();
  });
  it('resolves approved Ford model spelling without merging trim names or other brands', () => {
    const scoped = [
      term('towing_capacity', 'Capacidade de reboque', { model: 'F-150' }),
    ];
    expect(
      resolveTerm('Capacidade de reboque', { ...ford, model: 'F150' }, scoped),
    ).toBe('towing_capacity');
    expect(
      resolveTerm(
        'Capacidade de reboque',
        { ...ford, model: 'F-150 Lariat Black' },
        scoped,
      ),
    ).toBeUndefined();
    expect(
      resolveTerm(
        'Capacidade de reboque',
        { ...ford, brand: 'Toyota', model: 'F150' },
        scoped,
      ),
    ).toBeUndefined();
  });
});
