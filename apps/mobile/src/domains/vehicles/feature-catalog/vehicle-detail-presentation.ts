import { cellObservations } from '../data/vehicle-comparison';
import type { Comparison } from '../data/vehicle-contracts';
import { displayValue } from '../util/vehicle-display';
import {
  availabilityLabel,
  type FactStatus,
  formatPrice,
} from './catalog-presentation';

export interface DetailFact {
  readonly code: string;
  readonly label: string;
  readonly value: string;
  readonly status: FactStatus;
  readonly note?: string;
  readonly evidenceCount: number;
}

export interface DetailEvidence {
  readonly id: string;
  readonly title: string;
  readonly locator: string;
  readonly excerpt: string;
  readonly capturedOn: string;
  readonly provenance: string;
  readonly upstreamUrls: string[];
}

/** Every returned attribute of one configuration, with its uncertainty kept explicit. */
export function detailFacts(
  comparison: Comparison | undefined,
  configurationId: string,
  locale = 'en-US',
): DetailFact[] {
  return (
    comparison?.rows.map((row) => {
      const cell = row.cells.find(
        (candidate) => candidate.configurationId === configurationId,
      );
      if (!cell || cell.knowledgeStatus === 'NOT_REPORTED')
        return {
          code: row.attribute.code,
          label: row.attribute.label,
          value: 'Not reported',
          status: 'not-reported' as const,
          note: 'Missing information does not establish that equipment is absent.',
          evidenceCount: 0,
        };
      const observations = cellObservations(cell);
      if (cell.knowledgeStatus === 'CONFLICTING')
        return {
          code: row.attribute.code,
          label: row.attribute.label,
          value: 'Conflicting',
          status: 'conflicting' as const,
          note:
            cell.reason ??
            'Sources disagree; no observation has been silently preferred.',
          evidenceCount: observations.reduce(
            (total, observation) => total + observation.evidence.length,
            0,
          ),
        };
      const observation = observations[0];
      if (!observation)
        return {
          code: row.attribute.code,
          label: row.attribute.label,
          value: 'Not reported',
          status: 'not-reported' as const,
          evidenceCount: 0,
        };
      return {
        code: row.attribute.code,
        label: row.attribute.label,
        value: observationValue(
          observation.value,
          observation.availability,
          row.attribute.unit,
          row.attribute.code,
          locale,
        ),
        status: 'known' as const,
        note: qualifierContext(observation.qualifiers) || undefined,
        evidenceCount: observation.evidence.length,
      };
    }) ?? []
  );
}

function observationValue(
  value: unknown,
  availability: string | null,
  unit: string | null,
  code: string,
  locale: string,
): string {
  if (availability) return availabilityLabel(availability);
  if (code === 'reference_price' && typeof value === 'number')
    return formatPrice(value, locale);
  const formatted = displayValue(value);
  return `${formatted}${formatted && unit ? ` ${unit}` : ''}`;
}

function qualifierContext(qualifiers: Record<string, unknown>): string {
  const entries = Object.entries(qualifiers).filter(
    ([key, value]) =>
      value !== null &&
      value !== '' &&
      !['current_price_verified', 'effective_on'].includes(key),
  );
  return entries
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${displayValue(value)}`)
    .join(' · ');
}

/**
 * Known and conflicting facts first, in catalog order; unreported ones wait
 * behind a toggle (web vehicle detail, catalog gap audit 2026-09-21).
 */
export function splitReportedFacts(facts: DetailFact[]): {
  reported: DetailFact[];
  unreported: DetailFact[];
} {
  return {
    reported: facts.filter(({ status }) => status !== 'not-reported'),
    unreported: facts.filter(({ status }) => status === 'not-reported'),
  };
}

export function factByCode(facts: DetailFact[], code: string): DetailFact {
  return (
    facts.find((fact) => fact.code === code) ?? {
      code,
      label: code,
      value: 'Not reported',
      status: 'not-reported',
      evidenceCount: 0,
    }
  );
}

/** When the reference price was observed, so it is never read as today's price. */
export function referencePriceContext(
  comparison: Comparison | undefined,
  configurationId: string,
): string {
  const row = comparison?.rows.find(
    (candidate) => candidate.attribute.code === 'reference_price',
  );
  const cell = row?.cells.find(
    (candidate) => candidate.configurationId === configurationId,
  );
  const observation = cell ? cellObservations(cell)[0] : undefined;
  if (!observation) return 'No accepted reference-price observation.';
  const effectiveOn = observation.qualifiers['effective_on'];
  const verified = observation.qualifiers['current_price_verified'];
  if (typeof effectiveOn === 'string' && effectiveOn) {
    const suffix = verified === true ? ' · current price verified' : '';
    return `Source observation effective ${effectiveOn}${suffix}.`;
  }
  return 'Undated source observation — not a current market price.';
}

/** The distinct evidence behind the accepted observations of one configuration. */
export function detailEvidence(
  comparison: Comparison | undefined,
  configurationId: string,
): DetailEvidence[] {
  const evidence = new Map<string, DetailEvidence>();
  for (const row of comparison?.rows ?? []) {
    const cell = row.cells.find(
      (candidate) => candidate.configurationId === configurationId,
    );
    if (!cell) continue;
    for (const observation of cellObservations(cell)) {
      for (const item of observation.evidence) {
        evidence.set(item.id, {
          id: item.id,
          title: item.title,
          locator: item.locator,
          excerpt: item.excerpt,
          capturedOn: item.capturedOn,
          provenance: item.provenance,
          upstreamUrls: item.upstreamUrls,
        });
      }
    }
  }
  return [...evidence.values()];
}

export function sourceCountLabel(count: number): string {
  return count === 1 ? 'one source' : `${count} sources`;
}
