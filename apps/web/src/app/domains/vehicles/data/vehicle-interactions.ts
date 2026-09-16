import type { Comparison, VehicleConfiguration } from './vehicle-contracts';

export interface VehicleReviewsContext {
  comparison: Comparison;
  row: Comparison['rows'][number];
  configurationId?: string;
}

/** Structured intentions; the host decides how to handle them. */
export type VehicleQuestion =
  | { kind: 'vehicle'; vehicle: VehicleConfiguration }
  | {
      kind: 'comparison';
      configurations: VehicleConfiguration[];
      attributeCodes: string[];
    }
  | {
      kind: 'reviews';
      configurationIds: string[];
      attributeCode: string;
      evidenceIds: string[];
      observationIds: string[];
    }
  | {
      kind: 'discover';
      configurations: VehicleConfiguration[];
      attributeLabel: string;
    };
