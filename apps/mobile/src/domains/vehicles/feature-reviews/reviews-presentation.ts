import { cellObservations } from '../data/vehicle-comparison';
import type { Comparison } from '../data/vehicle-contracts';
import type {
  VehicleQuestion,
  VehicleReviewsContext,
} from '../data/vehicle-interactions';
import { type RelatedReview, reviewMedia } from '../data/vehicle-reviews';
import { displayValue } from '../util/vehicle-display';

export const MAX_SELECTED_REVIEWS = 8;

export interface ReviewFilters {
  /** A configuration id, or '' for every vehicle. */
  vehicle: string;
  /** A media label, or '' for every format. */
  media: string;
  query: string;
}

export function filterReviews(
  items: RelatedReview[],
  filters: ReviewFilters,
): RelatedReview[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return items.filter(
    (review) =>
      (!filters.vehicle ||
        review.relatedConfigurationIds.includes(filters.vehicle)) &&
      (!filters.media || reviewMedia(review.mediaType) === filters.media) &&
      `${review.title} ${review.author ?? ''} ${review.excerpt} ${displayValue(review.conditions)}`
        .toLocaleLowerCase()
        .includes(query),
  );
}

/** The distinct formats of the loaded reviews, as filter options. */
export function reviewMediaOptions(items: RelatedReview[]): string[] {
  return [...new Set(items.map((review) => reviewMedia(review.mediaType)))];
}

/** The names of the vehicles whose reviews could not be retrieved. */
export function failedVehicles(comparison: Comparison, ids: string[]): string {
  return comparison.configurations
    .filter((configuration) => ids.includes(configuration.id))
    .map((configuration) => configuration.name)
    .join(', ');
}

/** Adds or removes a review from the selection, which holds at most eight. */
export function toggleReviewSelection(ids: string[], id: string): string[] {
  return ids.includes(id)
    ? ids.filter((current) => current !== id)
    : ids.length < MAX_SELECTED_REVIEWS
      ? [...ids, id]
      : ids;
}

/** Only stable IDs cross into the question; never the review passages. */
export function reviewsQuestion(
  context: VehicleReviewsContext,
  reviews: RelatedReview[],
): VehicleQuestion {
  return {
    kind: 'reviews',
    attributeCode: context.row.attribute.code,
    configurationIds: context.comparison.configurations.map(({ id }) => id),
    evidenceIds: [...new Set(reviews.map((review) => review.evidenceId))],
    observationIds: reviews.map((review) => review.id),
  };
}

export function discoverQuestion(
  context: VehicleReviewsContext,
  vehicleFilter: string,
): VehicleQuestion {
  return {
    kind: 'discover',
    configurations: context.comparison.configurations.filter(
      ({ id }) => !vehicleFilter || id === vehicleFilter,
    ),
    attributeLabel: context.row.attribute.label,
  };
}

/** Which version a review is about; a model-scoped review names no version. */
export function reviewVehicleName(
  context: VehicleReviewsContext,
  review: RelatedReview,
): string {
  if (review.scope === 'MODEL')
    return 'About the model · version not confirmed';
  return (
    context.comparison.configurations.find(
      ({ id }) => id === review.configurationId,
    )?.name ?? 'Reviewed version'
  );
}

/** The specification of one vehicle for the attribute under review. */
export function reviewSpecification(
  context: VehicleReviewsContext,
  configurationId: string,
  locale = 'en-US',
): string {
  const cell = context.row.cells.find(
    (candidate) => candidate.configurationId === configurationId,
  );
  if (!cell || cell.knowledgeStatus === 'NOT_REPORTED') return 'Not reported';
  if (cell.knowledgeStatus === 'CONFLICTING') return 'Conflicting data';
  return cellObservations(cell)
    .map((observation) => {
      const availability = (
        {
          STANDARD: 'Standard',
          OPTIONAL: 'Optional',
          ABSENT: 'Not available',
          NOT_APPLICABLE: 'Not applicable',
        } as Record<string, string>
      )[observation.availability ?? ''];
      const value =
        observation.value === null
          ? ''
          : `${displayValue(observation.value)} ${context.row.attribute.unit ?? ''}`.trim();
      const rpm = observation.qualifiers['engine_speed_rpm'];
      return [
        value,
        availability,
        typeof rpm === 'number'
          ? `${rpm.toLocaleString(locale)} rpm`
          : undefined,
      ]
        .filter(Boolean)
        .join(' · ');
    })
    .join(' · ');
}

export function reviewKind(kind: string | null | undefined): string {
  return (
    (
      {
        OPINION: 'Reviewer opinion',
        MEASUREMENT: 'Reviewer measurement',
        REPORTED_SPEC: 'Specification quoted in the report',
        OWNER_EXPERIENCE: 'Owner experience',
      } as Record<string, string>
    )[kind ?? ''] ?? 'Report'
  );
}
