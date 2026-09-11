import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { type FieldTree, FormField } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';

import { ZardSkeletonComponent } from '@/ui/components/skeleton';

import {
  cellObservations,
  comparisonRows,
} from '../../data/vehicle-comparison';
import type {
  Comparison,
  VehicleImageMetadata,
} from '../../data/vehicle-contracts';
import { VehicleImage } from '../../ui/vehicle-image';
import { displayValue, safeSourceUrl } from '../../util/vehicle-display';

type Row = Comparison['rows'][number];
type Cell = Row['cells'][number];
type Observation = Cell['observations'][number];

interface CellSummary {
  readonly text: string;
  readonly tone: 'value' | 'availability' | 'muted' | 'warning';
}

/**
 * The comparison as an attribute list attached to the reply: the vehicles
 * are numbered once in a legend that stays pinned while the list scrolls,
 * every attribute is one hairline row with the values as numbered chips, and
 * sources open per row. Tapping a number (in the legend or a chip) names
 * that vehicle next to its values, which also serves touch screens.
 */
@Component({
  selector: 'app-vehicle-comparison-card',
  imports: [FormField, NgIcon, ZardSkeletonComponent, VehicleImage],
  viewProviders: [provideIcons({ lucideSearch })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
  templateUrl: './vehicle-comparison-card.html',
})
export class VehicleComparisonCard {
  readonly images = input<Record<string, VehicleImageMetadata | null>>();
  readonly result = input<Comparison>();
  readonly failure = input<string>();
  readonly complete = input(false);
  readonly questionsEnabled = input(true);
  readonly queryField = input.required<FieldTree<string>>();
  readonly differencesOnly = input(false);
  readonly rows = input<Row[]>([]);
  readonly differencesChanged = output<boolean>();
  readonly filtersCleared = output<void>();
  readonly reviewsRequested = output<{
    row: Row;
    configurationId?: string;
  }>();
  readonly followUpRequested = output<void>();

  /** Numbers only make sense against other vehicles. */
  protected readonly numbered = computed(
    () => (this.result()?.configurations.length ?? 0) > 1,
  );
  /** Attribute ids whose cells differ or are uncertain. */
  protected readonly differing = computed(
    () =>
      new Set(
        comparisonRows(this.result(), true).map((row) => row.attribute.id),
      ),
  );
  /** Configurations whose name is shown next to every one of their values. */
  protected readonly named = signal<ReadonlySet<string>>(new Set());
  protected readonly observations = cellObservations;
  protected readonly format = displayValue;
  protected readonly safeUrl = safeSourceUrl;
  protected readonly availability = availabilityLabel;
  protected readonly qualifiers = qualifierLabels;

  protected isNamed(configurationId: string): boolean {
    return this.named().has(configurationId);
  }
  protected toggleName(configurationId: string): void {
    this.named.update((named) => {
      const next = new Set(named);
      if (!next.delete(configurationId)) next.add(configurationId);
      return next;
    });
  }
  protected readonly comparisonTitle = $localize`Specification comparison`;
  protected readonly singleTitle = $localize`Vehicle specifications`;
  protected readonly curatedNote = $localize`Compiled notes`;
  protected readonly provisionalIdentityNote = $localize`Identity based on compiled notes; check the source to confirm the version.`;
  protected readonly unavailableComparison = $localize`This comparison could not be displayed. Ask the assistant to try again.`;
  protected readonly loadingComparison = $localize`Looking up specifications and sources…`;

  protected nameToggleLabel(configuration: {
    model: string;
    name: string;
  }): string {
    const vehicle = `${configuration.model} ${configuration.name}`;
    return $localize`Show the name of ${vehicle}:vehicle: next to the values`;
  }
  protected reviewsLabel(row: Row): string {
    const attribute = row.attribute.label;
    return $localize`See reviews about ${attribute}:attribute:`;
  }
  protected versionReportsLabel(
    configuration: { name: string },
    row: Row,
  ): string {
    const version = configuration.name;
    const attribute = row.attribute.label;
    return $localize`Reports for this version: ${version}:version: about ${attribute}:attribute:`;
  }

  protected cell(row: Row, configurationId: string): Cell | undefined {
    return row.cells.find((cell) => cell.configurationId === configurationId);
  }
  protected summary(row: Row, configurationId: string): CellSummary {
    const cell = this.cell(row, configurationId);
    if (!cell || cell.knowledgeStatus === 'NOT_REPORTED')
      return { text: '—', tone: 'muted' };
    if (cell.knowledgeStatus === 'CONFLICTING')
      return { text: $localize`Conflicting`, tone: 'warning' };
    const observation = cellObservations(cell)[0];
    if (!observation) return { text: '—', tone: 'muted' };
    if (observation.value !== null)
      return {
        text: `${displayValue(observation.value)}${row.attribute.unit ? ` ${row.attribute.unit}` : ''}`,
        tone: 'value',
      };
    if (observation.availability)
      return {
        text: availabilityLabel(observation.availability),
        tone: 'availability',
      };
    return { text: '—', tone: 'muted' };
  }
  /** Whether a row has anything beyond the chip values: unknowns, qualifiers or evidence. */
  protected hasDetails(row: Row): boolean {
    return row.cells.some(
      (cell) =>
        cell.knowledgeStatus !== 'KNOWN' ||
        cellObservations(cell).some(
          (observation) =>
            Object.keys(observation.qualifiers).length > 0 ||
            observation.evidence.length > 0,
        ),
    );
  }
  protected observationValue(observation: Observation, row: Row): string {
    const value =
      observation.value === null ? '' : displayValue(observation.value);
    return [
      value && row.attribute.unit ? `${value} ${row.attribute.unit}` : value,
      availabilityLabel(observation.availability),
    ]
      .filter(Boolean)
      .join(' · ');
  }
  protected openReviews(row: Row, configurationId?: string): void {
    this.reviewsRequested.emit({ row, configurationId });
  }
}
function availabilityLabel(value: string | null) {
  return (
    (
      {
        STANDARD: $localize`Standard`,
        OPTIONAL: $localize`Optional`,
        ABSENT: $localize`Not available`,
        NOT_APPLICABLE: $localize`Not applicable`,
      } as Record<string, string>
    )[value ?? ''] ?? ''
  );
}
function qualifierLabels(qualifiers: Record<string, unknown>) {
  const labels: Record<string, string> = {
    rpm: $localize`Engine speed (rpm)`,
    engine_speed_rpm: $localize`Engine speed (rpm)`,
    engine_speed_rpm_min: $localize`Minimum engine speed (rpm)`,
    engine_speed_rpm_max: $localize`Maximum engine speed (rpm)`,
    package: $localize`Package`,
    packages: $localize`Packages`,
    fuel: $localize`Fuel`,
    conditions: $localize`Conditions`,
    scope: $localize`Scope`,
    date: $localize`Date`,
    note: $localize`Note`,
    source_unit: $localize`Unit in the source`,
    source_value: $localize`Value in the source`,
    source_scope: $localize`Scope in the source`,
    source_section: $localize`Section of the source`,
    source_also_mentions: $localize`The source also mentions`,
    manufacturer_term: $localize`Manufacturer term`,
    completeness: $localize`Coverage`,
    conversion_factor: $localize`Conversion factor`,
    current_price_verified: $localize`Current price verified`,
    effective_on: $localize`Effective on`,
    interpretation: $localize`Interpretation`,
    moving_object_detection: $localize`Moving object detection`,
    off_road: $localize`Off-road use`,
    price_kind: $localize`Price type`,
    stop_and_go: $localize`Stop and go`,
    same_as_first_column: $localize`Same value as the first column in the source`,
  };
  const yes = $localize`Yes`;
  const no = $localize`No`;
  return Object.entries(qualifiers).map(([key, value]) =>
    key === 'package_id'
      ? $localize`Tied to an optional package. Check the conditions in the source.`
      : `${labels[key] ?? key.replace(/_/g, ' ')}: ${typeof value === 'boolean' ? (value ? yes : no) : displayValue(value)}`,
  );
}
