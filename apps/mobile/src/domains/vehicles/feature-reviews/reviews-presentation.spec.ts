import type { Comparison } from '../data/vehicle-contracts';
import type { VehicleReviewsContext } from '../data/vehicle-interactions';
import type { RelatedReview } from '../data/vehicle-reviews';
import {
  discoverQuestion,
  failedVehicles,
  filterReviews,
  MAX_SELECTED_REVIEWS,
  reviewKind,
  reviewMediaOptions,
  reviewSpecification,
  reviewsQuestion,
  reviewVehicleName,
  toggleReviewSelection,
} from './reviews-presentation';

const black = '08e08761-a2e7-5ae5-b2ad-387e93829fb7';
const limited = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
const configuration = {
  id: black,
  brand: 'Ford',
  model: 'Ranger',
  name: 'Black',
  market: 'BR',
  modelYear: 2026,
  identityStatus: 'PROVISIONAL',
  identityNote: null,
  identityEvidenceId: null,
};
const comparison: Comparison = {
  configurations: [
    configuration,
    { ...configuration, id: limited, name: 'Limited' },
  ],
  rows: [
    {
      attribute: {
        id: black,
        code: 'torque_max',
        label: 'Torque',
        description: null,
        valueType: 'NUMBER',
        unit: 'Nm',
      },
      cells: [
        {
          configurationId: black,
          knowledgeStatus: 'KNOWN',
          reason: null,
          selectedObservationId: black,
          observations: [
            {
              id: black,
              value: 500,
              availability: null,
              qualifiers: { engine_speed_rpm: 1750 },
              rawValue: null,
              reviewStatus: 'ACCEPTED',
              evidence: [],
            },
          ],
        },
        {
          configurationId: limited,
          knowledgeStatus: 'CONFLICTING',
          reason: null,
          selectedObservationId: null,
          observations: [],
        },
      ],
    },
  ],
};
const context: VehicleReviewsContext = {
  comparison,
  row: comparison.rows[0] as Comparison['rows'][number],
};

const modelReview: RelatedReview = {
  id: 'b9e06761-a2e7-5ae5-b2ad-387e93829fb7',
  evidenceId: 'c9e06761-a2e7-5ae5-b2ad-387e93829fb7',
  title: 'Road test',
  excerpt: 'Exact passage about the torque.',
  scope: 'MODEL',
  mediaType: 'VIDEO',
  conditions: null,
  relatedConfigurationIds: [black, limited],
};
const versionReview: RelatedReview = {
  ...modelReview,
  id: 'd9e06761-a2e7-5ae5-b2ad-387e93829fb7',
  title: 'Owner notes',
  author: 'Ana',
  scope: 'CONFIGURATION',
  configurationId: limited,
  mediaType: 'ARTICLE',
  kind: 'OWNER_EXPERIENCE',
  relatedConfigurationIds: [limited],
};

describe('reviews presentation', () => {
  it('filters by vehicle, format and text', () => {
    const items = [modelReview, versionReview];
    expect(
      filterReviews(items, { vehicle: black, media: '', query: '' }),
    ).toEqual([modelReview]);
    expect(
      filterReviews(items, { vehicle: '', media: 'Article', query: '' }),
    ).toEqual([versionReview]);
    expect(
      filterReviews(items, { vehicle: '', media: '', query: 'ana' }),
    ).toEqual([versionReview]);
    expect(reviewMediaOptions(items)).toEqual(['Video', 'Article']);
  });

  it('caps the selection at eight reports', () => {
    const full = Array.from(
      { length: MAX_SELECTED_REVIEWS },
      (_, index) => `r${index}`,
    );
    expect(toggleReviewSelection(full, 'extra')).toBe(full);
    expect(toggleReviewSelection(full, 'r0')).toHaveLength(7);
    expect(toggleReviewSelection([], 'r0')).toEqual(['r0']);
  });

  it('asks about selected reports by stable IDs only', () => {
    const question = reviewsQuestion(context, [modelReview, versionReview]);
    expect(question).toEqual({
      kind: 'reviews',
      attributeCode: 'torque_max',
      configurationIds: [black, limited],
      evidenceIds: [modelReview.evidenceId],
      observationIds: [modelReview.id, versionReview.id],
    });
    expect(JSON.stringify(question)).not.toContain(modelReview.excerpt);
    expect(discoverQuestion(context, limited)).toMatchObject({
      kind: 'discover',
      attributeLabel: 'Torque',
      configurations: [{ id: limited }],
    });
  });

  it('never claims a version for model-scoped reports', () => {
    expect(reviewVehicleName(context, modelReview)).toBe(
      'About the model · version not confirmed',
    );
    expect(reviewVehicleName(context, versionReview)).toBe('Limited');
    expect(reviewKind(versionReview.kind)).toBe('Owner experience');
    expect(reviewKind(undefined)).toBe('Report');
  });

  it('summarises each vehicle specification and names failed lookups', () => {
    expect(reviewSpecification(context, black)).toBe('500 Nm · 1,750 rpm');
    expect(reviewSpecification(context, limited)).toBe('Conflicting data');
    expect(reviewSpecification(context, 'other')).toBe('Not reported');
    expect(failedVehicles(comparison, [limited])).toBe('Limited');
  });
});
