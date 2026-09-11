import { z } from 'zod';

import {
  comparisonSchema,
  configurationSchema,
  failureSchema,
  knowledgeSchema,
  searchSchema,
  selectionSchema,
  singleSelectionSchema,
} from '../catalog/contracts';

export const VEHICLE_WORKSPACE_CATALOG =
  'urn:specsync:a2ui:vehicle-workspace:1';

const titleSchema = z.string().trim().min(1).max(120);
// The API treats omitted or empty attributes as all definitions and evidence.
const attributesSchema = selectionSchema.shape.attributes
  .unwrap()
  .min(1)
  .max(12);
const catalogArgsSchema = searchSchema
  .extend({
    limit: z.number().int().min(1).max(8).default(6),
    offset: z.literal(0),
  })
  .strict();
const comparisonArgsSchema = selectionSchema
  .extend({ attributes: attributesSchema })
  .strict();
const specificationsArgsSchema = singleSelectionSchema
  .extend({ attributes: attributesSchema })
  .strict();
const reviewsArgsSchema = z
  .object({
    configurationId: z.string().uuid(),
    q: z.string().max(200).default(''),
    attributeCode: attributesSchema.element.optional(),
    limit: z.number().int().min(1).max(6).default(4),
  })
  .strict();

const catalogTileSchema = catalogArgsSchema.omit({ offset: true }).extend({
  type: z.literal('catalog'),
  title: titleSchema,
});
const comparisonTileSchema = comparisonArgsSchema.extend({
  type: z.literal('comparison'),
  title: titleSchema,
});
const specificationsTileSchema = specificationsArgsSchema.extend({
  type: z.literal('specifications'),
  title: titleSchema,
});
const reviewsTileSchema = reviewsArgsSchema.extend({
  type: z.literal('reviews'),
  title: titleSchema,
});

/** The model selects retrieval operations; it cannot supply facts or UI code. */
export const vehicleWorkspaceInputSchema = z
  .object({
    title: titleSchema,
    tiles: z
      .array(
        z.discriminatedUnion('type', [
          catalogTileSchema,
          comparisonTileSchema,
          specificationsTileSchema,
          reviewsTileSchema,
        ]),
      )
      .min(1)
      .max(4),
  })
  .strict();

export const workspaceCatalogPageSchema = z.object({
  items: z.array(configurationSchema),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
});

export const resolvedWorkspaceTileSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('catalog'),
      title: titleSchema,
      args: catalogArgsSchema,
      result: z.union([workspaceCatalogPageSchema, failureSchema]),
    })
    .strict(),
  z
    .object({
      type: z.literal('comparison'),
      title: titleSchema,
      args: comparisonArgsSchema,
      result: z.union([comparisonSchema, failureSchema]),
    })
    .strict(),
  z
    .object({
      type: z.literal('specifications'),
      title: titleSchema,
      args: specificationsArgsSchema,
      result: z.union([comparisonSchema, failureSchema]),
    })
    .strict(),
  z
    .object({
      type: z.literal('reviews'),
      title: titleSchema,
      args: reviewsArgsSchema,
      result: z.union([knowledgeSchema, failureSchema]),
    })
    .strict(),
]);

const surfaceIdSchema = z.string().regex(/^workspace-[0-9a-f-]{36}$/);
const rootComponentSchema = z
  .object({
    id: z.literal('root'),
    component: z.literal('Column'),
    children: z
      .array(z.string().regex(/^tile-[0-3]$/))
      .min(1)
      .max(4),
  })
  .strict();
const tileComponentSchema = z
  .object({
    id: z.string().regex(/^tile-[0-3]$/),
    component: z.enum([
      'VehicleCatalog',
      'VehicleComparison',
      'VehicleEvidence',
    ]),
    data: z.object({ path: z.string().regex(/^\/tiles\/[0-3]$/) }).strict(),
  })
  .strict();

/** A small, versioned A2UI profile transported in durable AG-UI tool results. */
export const vehicleWorkspaceOutputSchema = z
  .object({
    status: z.enum(['OK', 'PARTIAL', 'ERROR']),
    title: titleSchema,
    operations: z.tuple([
      z
        .object({
          version: z.literal('v0.9'),
          createSurface: z
            .object({
              surfaceId: surfaceIdSchema,
              catalogId: z.literal(VEHICLE_WORKSPACE_CATALOG),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          version: z.literal('v0.9'),
          updateComponents: z
            .object({
              surfaceId: surfaceIdSchema,
              components: z
                .array(z.union([rootComponentSchema, tileComponentSchema]))
                .min(2)
                .max(5),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          version: z.literal('v0.9'),
          updateDataModel: z
            .object({
              surfaceId: surfaceIdSchema,
              path: z.literal('/'),
              value: z
                .object({
                  tiles: z.array(resolvedWorkspaceTileSchema).min(1).max(4),
                })
                .strict(),
            })
            .strict(),
        })
        .strict(),
    ]),
  })
  .strict();

export type VehicleWorkspaceInput = z.infer<typeof vehicleWorkspaceInputSchema>;
export type ResolvedWorkspaceTile = z.infer<typeof resolvedWorkspaceTileSchema>;
export type VehicleWorkspaceOutput = z.infer<
  typeof vehicleWorkspaceOutputSchema
>;
