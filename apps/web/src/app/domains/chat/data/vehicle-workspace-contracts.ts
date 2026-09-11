import { z } from 'zod';

import {
  catalogPageSchema,
  comparisonSchema,
  failureSchema,
  knowledgeSchema,
} from '../../vehicles/api/contracts';

export const VEHICLE_WORKSPACE_CATALOG_ID =
  'urn:specsync:a2ui:vehicle-workspace:1';

const titleSchema = z.string().trim().min(1).max(120);
const attributeCodeSchema = z.string().regex(/^[a-z][a-z0-9_]{0,79}$/);
const attributesSchema = z.array(attributeCodeSchema).min(1).max(12);
const surfaceIdSchema = z
  .string()
  .regex(
    /^workspace-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
const tileIdSchema = z.string().regex(/^tile-[0-3]$/);
const failure = failureSchema.strict();

const catalogTileSchema = z
  .object({
    type: z.literal('catalog'),
    title: titleSchema,
    args: z
      .object({
        q: z.string().max(100),
        market: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .optional(),
        modelYear: z.number().int().min(1900).max(2200).optional(),
        limit: z.number().int().min(1).max(8),
        offset: z.literal(0),
      })
      .strict(),
    result: z.union([catalogPageSchema.strict(), failure]),
  })
  .strict();

const comparisonTileSchema = z
  .object({
    type: z.literal('comparison'),
    title: titleSchema,
    args: z
      .object({
        configurationIds: z.array(z.string().uuid()).min(2).max(5),
        attributes: attributesSchema,
      })
      .strict(),
    result: z.union([comparisonSchema.strict(), failure]),
  })
  .strict();

const specificationsTileSchema = z
  .object({
    type: z.literal('specifications'),
    title: titleSchema,
    args: z
      .object({
        configurationId: z.string().uuid(),
        attributes: attributesSchema,
      })
      .strict(),
    result: z.union([comparisonSchema.strict(), failure]),
  })
  .strict();

const reviewsTileSchema = z
  .object({
    type: z.literal('reviews'),
    title: titleSchema,
    args: z
      .object({
        configurationId: z.string().uuid(),
        q: z.string().max(200),
        attributeCode: attributeCodeSchema.optional(),
        limit: z.number().int().min(1).max(6),
      })
      .strict(),
    result: z.union([knowledgeSchema.strict(), failure]),
  })
  .strict();

const tileSchema = z.discriminatedUnion('type', [
  catalogTileSchema,
  comparisonTileSchema,
  specificationsTileSchema,
  reviewsTileSchema,
]);

const componentSchema = z.union([
  z
    .object({
      id: z.literal('root'),
      component: z.literal('Column'),
      children: z.array(tileIdSchema).min(1).max(4),
    })
    .strict(),
  z
    .object({
      id: tileIdSchema,
      component: z.enum([
        'VehicleCatalog',
        'VehicleComparison',
        'VehicleEvidence',
      ]),
      data: z.object({ path: z.string().regex(/^\/tiles\/[0-3]$/) }).strict(),
    })
    .strict(),
]);

/** A bounded A2UI v0.9 catalog profile, with one root and data-bound leaves. */
export const vehicleWorkspaceSchema = z
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
              catalogId: z.literal(VEHICLE_WORKSPACE_CATALOG_ID),
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
              components: z.array(componentSchema).min(2).max(5),
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
                .object({ tiles: z.array(tileSchema).min(1).max(4) })
                .strict(),
            })
            .strict(),
        })
        .strict(),
    ]),
  })
  .strict()
  .superRefine((workspace, context) => {
    const [create, update, model] = workspace.operations;
    const surfaceId = create.createSurface.surfaceId;
    if (
      update.updateComponents.surfaceId !== surfaceId ||
      model.updateDataModel.surfaceId !== surfaceId
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Operations must target one surface.',
      });
    }

    const components = update.updateComponents.components;
    const [root, ...leaves] = components;
    const tiles = model.updateDataModel.value.tiles;
    const ids = new Set(components.map((component) => component.id));
    if (
      ids.size !== components.length ||
      root?.component !== 'Column' ||
      leaves.length !== tiles.length ||
      root.children.length !== tiles.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'The surface must have one root and one leaf per tile.',
      });
      return;
    }

    tiles.forEach((tile, index) => {
      const leaf = leaves[index];
      const expectedId = `tile-${index}`;
      const expectedComponent =
        tile.type === 'catalog'
          ? 'VehicleCatalog'
          : tile.type === 'reviews'
            ? 'VehicleEvidence'
            : 'VehicleComparison';
      if (
        root.children[index] !== expectedId ||
        leaf?.id !== expectedId ||
        leaf.component !== expectedComponent ||
        !('data' in leaf) ||
        leaf.data.path !== `/tiles/${index}`
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Every catalog component must bind to its matching tile.',
        });
      }
    });

    const failed = tiles.filter(
      (tile) =>
        'status' in tile.result &&
        ['ERROR', 'UNAVAILABLE'].includes(tile.result.status ?? ''),
    ).length;
    const expectedStatus =
      failed === 0 ? 'OK' : failed === tiles.length ? 'ERROR' : 'PARTIAL';
    if (workspace.status !== expectedStatus) {
      context.addIssue({
        code: 'custom',
        message: 'Workspace status must describe its tile results.',
      });
    }
  });

export type VehicleWorkspace = z.infer<typeof vehicleWorkspaceSchema>;
export type VehicleWorkspaceTile = z.infer<typeof tileSchema>;

export function vehicleWorkspaceTiles(
  workspace: VehicleWorkspace,
): VehicleWorkspaceTile[] {
  return workspace.operations[2].updateDataModel.value.tiles;
}
