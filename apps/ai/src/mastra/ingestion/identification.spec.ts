import { describe, expect, it } from 'vitest';

import {
  type IdentifiedConfiguration,
  nameTokens,
  selectConfigurations,
} from './identification';

const found = (
  name: string,
  column: string | null = null,
  powertrain: string | null = null,
): IdentifiedConfiguration => ({
  name,
  column,
  powertrain,
  lineStart: 1,
  lineEnd: 1,
  locator: 'header',
  excerpt: name,
});

describe('configuration selection', () => {
  const ranger = [
    found('XLS 2.0 AT', 'XLS', '2.0 Diesel AT 4x4'),
    found('XLT 2.0 AT', 'XLT', '2.0 Diesel AT 4x4'),
    found('LIMITED 3.0 V6', 'LIMITED', '3.0 V6 Diesel AT 4x4'),
    found('RAPTOR 3.0 V6', 'RAPTOR', '3.0 V6 Gasolina AT 4x4'),
  ];
  it('matches curator names to printed names by token overlap and keeps the curator name', () => {
    const { scopes, warnings } = selectConfigurations(
      ['Limited 3.0 V6 AT Diesel', 'XLT 2.0 AT Diesel'],
      ranger,
    );
    expect(scopes.map((scope) => scope.name)).toEqual([
      'Limited 3.0 V6 AT Diesel',
      'XLT 2.0 AT Diesel',
    ]);
    expect(scopes.map((scope) => scope.found.name)).toEqual([
      'LIMITED 3.0 V6',
      'XLT 2.0 AT',
    ]);
    expect(warnings).toEqual([
      'The source also presents configurations that were not requested: XLS 2.0 AT, RAPTOR 3.0 V6.',
    ]);
  });
  it('reports requested configurations the source does not present', () => {
    const { scopes, warnings } = selectConfigurations(
      ['Storm 2.2 Diesel'],
      ranger,
    );
    expect(scopes).toEqual([]);
    expect(warnings[0]).toContain('"Storm 2.2 Diesel" was not found');
  });
  it('selects everything up to the run limit when nothing is named', () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      found(`Trim ${index}`),
    );
    const { scopes, warnings } = selectConfigurations([], many);
    expect(scopes).toHaveLength(8);
    expect(warnings[0]).toContain('only the first 8');
    expect(selectConfigurations([], []).warnings[0]).toContain(
      'No configuration identity',
    );
  });
  it('normalizes accents and punctuation in names', () => {
    expect(nameTokens('Versão Limited 3.0-V6, Diesel')).toEqual([
      'versao',
      'limited',
      '3.0',
      'v6',
      'diesel',
    ]);
  });
});
