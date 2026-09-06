import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBadgeCheck,
  lucideCarFront,
  lucideCheck,
  lucideCircleAlert,
  lucideCircleHelp,
  lucideInfo,
  lucideMessageCircle,
  lucideRotateCcw,
  lucideX,
} from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';
import { ZardTabsImports } from '@/ui/components/tabs';

import { cellObservations } from '../../data/vehicle-comparison';
import type {
  Comparison,
  VehicleConfiguration,
} from '../../data/vehicle-contracts';
import { displayValue, safeSourceUrl } from '../../util/vehicle-display';

interface DetailFact {
  readonly code: string;
  readonly label: string;
  readonly value: string;
  readonly status: 'known' | 'not-reported' | 'conflicting';
  readonly note?: string;
  readonly evidenceCount: number;
}

interface DetailEvidence {
  readonly id: string;
  readonly title: string;
  readonly locator: string;
  readonly excerpt: string;
  readonly capturedOn: string;
  readonly provenance: string;
  readonly upstreamUrls: string[];
}

@Component({
  selector: 'app-vehicle-detail-pane',
  imports: [
    NgIcon,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardSkeletonComponent,
    ...ZardTabsImports,
  ],
  viewProviders: [
    provideIcons({
      lucideBadgeCheck,
      lucideCarFront,
      lucideCheck,
      lucideCircleAlert,
      lucideCircleHelp,
      lucideInfo,
      lucideMessageCircle,
      lucideRotateCcw,
      lucideX,
    }),
  ],
  templateUrl: './vehicle-detail-pane.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 min-h-0 flex-col overflow-hidden' },
})
export class VehicleDetailPane {
  readonly vehicle = input.required<VehicleConfiguration>();
  readonly comparison = input<Comparison>();
  readonly loading = input(false);
  readonly failed = input(false);

  readonly closed = output<void>();
  readonly retried = output<void>();
  readonly askRequested = output<void>();

  protected readonly facts = computed(() =>
    detailFacts(this.comparison(), this.vehicle().id),
  );
  protected readonly knownCount = computed(
    () => this.facts().filter(({ status }) => status === 'known').length,
  );
  protected readonly uncertainCount = computed(
    () => this.facts().length - this.knownCount(),
  );
  protected readonly evidence = computed(() =>
    detailEvidence(this.comparison(), this.vehicle().id),
  );
  protected readonly price = computed(() =>
    factByCode(this.facts(), 'reference_price'),
  );
  protected readonly priceContext = computed(() =>
    referencePriceContext(this.comparison(), this.vehicle().id),
  );
  protected readonly power = computed(() =>
    factByCode(this.facts(), 'power_max'),
  );
  protected readonly torque = computed(() =>
    factByCode(this.facts(), 'torque_max'),
  );
  protected readonly drivetrain = computed(() =>
    factByCode(this.facts(), 'drivetrain'),
  );
  protected readonly safeUrl = safeSourceUrl;
}

function detailFacts(
  comparison: Comparison | undefined,
  configurationId: string,
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
        ),
        status: 'known' as const,
        note: qualifierContext(observation.qualifiers),
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
): string {
  if (availability)
    return (
      (
        {
          STANDARD: 'Standard',
          OPTIONAL: 'Optional',
          ABSENT: 'Absent',
          NOT_APPLICABLE: 'Not applicable',
        } as Record<string, string>
      )[availability] ?? availability
    );
  if (code === 'reference_price' && typeof value === 'number')
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
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

function factByCode(facts: DetailFact[], code: string): DetailFact {
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

function referencePriceContext(
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
  if (typeof effectiveOn === 'string' && effectiveOn)
    return `Source observation effective ${effectiveOn}${verified === true ? ' · current price verified' : ''}.`;
  return 'Undated source observation — not a current market price.';
}

function detailEvidence(
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
