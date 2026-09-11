import { matrix } from '../../../testing/vehicle-fixtures';
import { parseResult } from '../util/parse-result';
import {
  VEHICLE_WORKSPACE_CATALOG_ID,
  vehicleWorkspaceSchema,
  type VehicleWorkspaceTile,
  vehicleWorkspaceTiles,
} from './vehicle-workspace-contracts';

const surfaceId = 'workspace-08e08761-a2e7-5ae5-b2ad-387e93829fb7';
const comparison: VehicleWorkspaceTile = {
  type: 'comparison',
  title: 'Compare selected configurations',
  args: {
    configurationIds: matrix.configurations.map(({ id }) => id),
    attributes: matrix.rows.map(({ attribute }) => attribute.code),
  },
  result: matrix,
};
const catalog: VehicleWorkspaceTile = {
  type: 'catalog',
  title: 'Explore Ranger',
  args: { q: 'Ranger', limit: 6, offset: 0 },
  result: { items: matrix.configurations, limit: 6, offset: 0, hasMore: false },
};
const reviews: VehicleWorkspaceTile = {
  type: 'reviews',
  title: 'Review passages',
  args: { configurationId: matrix.configurations[0].id, q: '', limit: 4 },
  result: {
    status: 'EMPTY',
    message: 'No indexed passages.',
    projectionVersion: null,
    items: [],
  },
};

function workspace(tiles: VehicleWorkspaceTile[] = [comparison]) {
  return {
    status: 'OK',
    title: 'Ranger research',
    operations: [
      {
        version: 'v0.9',
        createSurface: { surfaceId, catalogId: VEHICLE_WORKSPACE_CATALOG_ID },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          components: [
            {
              id: 'root',
              component: 'Column',
              children: tiles.map((_, index) => `tile-${index}`),
            },
            ...tiles.map((tile, index) => ({
              id: `tile-${index}`,
              component:
                tile.type === 'catalog'
                  ? 'VehicleCatalog'
                  : tile.type === 'reviews'
                    ? 'VehicleEvidence'
                    : 'VehicleComparison',
              data: { path: `/tiles/${index}` },
            })),
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: { surfaceId, path: '/', value: { tiles } },
      },
    ],
  };
}

function withComponents(components: unknown[]) {
  const valid = workspace();
  return {
    ...valid,
    operations: [
      valid.operations[0],
      {
        version: 'v0.9',
        updateComponents: { surfaceId, components },
      },
      valid.operations[2],
    ],
  };
}

describe('vehicle workspace catalog boundary', () => {
  it('accepts the four supported tile types and retains authoritative domain payloads', () => {
    const parsed = vehicleWorkspaceSchema.parse(
      workspace([
        catalog,
        comparison,
        {
          type: 'specifications',
          title: 'Specifications',
          args: {
            configurationId: matrix.configurations[0].id,
            attributes: matrix.rows.map(({ attribute }) => attribute.code),
          },
          result: { ...matrix, configurations: [matrix.configurations[0]] },
        },
        reviews,
      ]),
    );
    expect(vehicleWorkspaceTiles(parsed).map(({ type }) => type)).toEqual([
      'catalog',
      'comparison',
      'specifications',
      'reviews',
    ]);
    expect(vehicleWorkspaceTiles(parsed)[1].result).toEqual(matrix);
  });

  it('rejects unsupported catalog IDs, versions, operation counts and foreign surfaces', () => {
    const valid = workspace();
    const create = valid.operations[0];
    const update = valid.operations[1];
    const model = valid.operations[2];
    const invalidOperations = [
      [
        {
          ...create,
          createSurface: {
            surfaceId,
            catalogId: 'https://untrusted.example/catalog',
          },
        },
        update,
        model,
      ],
      [{ ...create, version: 'v0.8' }, update, model],
      [
        create,
        update,
        model,
        { version: 'v0.9', deleteSurface: { surfaceId } },
      ],
      [
        create,
        {
          version: 'v0.9',
          updateComponents: {
            ...update.updateComponents,
            surfaceId: 'workspace-f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
          },
        },
        model,
      ],
      [
        create,
        update,
        {
          version: 'v0.9',
          updateDataModel: {
            ...model.updateDataModel,
            surfaceId: 'workspace-f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
          },
        },
      ],
    ];
    for (const operations of invalidOperations) {
      expect(
        vehicleWorkspaceSchema.safeParse({ ...valid, operations }).success,
      ).toBe(false);
    }
  });

  it('rejects cycles, duplicate IDs, unknown children, unreferenced nodes and mismatched bindings', () => {
    const root = { id: 'root', component: 'Column', children: ['tile-0'] };
    const leaf = {
      id: 'tile-0',
      component: 'VehicleComparison',
      data: { path: '/tiles/0' },
    };
    const invalidComponents = [
      [{ ...root, children: ['root'] }, leaf],
      [root, { ...leaf, children: ['root'] }],
      [root, leaf, leaf],
      [{ ...root, children: ['tile-1'] }, leaf],
      [root, leaf, { ...leaf, id: 'tile-1' }],
      [root, { ...leaf, data: { path: '/tiles/1' } }],
      [root, { ...leaf, data: { path: '/__proto__' } }],
      [root, { ...leaf, component: 'VehicleCatalog' }],
      [root, { ...leaf, component: 'HTML', html: '<script>bad()</script>' }],
    ];
    for (const components of invalidComponents) {
      expect(
        vehicleWorkspaceSchema.safeParse(withComponents(components)).success,
      ).toBe(false);
    }
  });

  it('rejects non-domain data, invented args and extra presentation properties', () => {
    const valid = workspace();
    const modelWith = (tiles: unknown[]) => ({
      ...valid,
      operations: [
        valid.operations[0],
        valid.operations[1],
        {
          version: 'v0.9',
          updateDataModel: { surfaceId, path: '/', value: { tiles } },
        },
      ],
    });
    const invalidTiles = [
      {
        ...comparison,
        result: { configurations: [{ id: 'invented' }], rows: [] },
      },
      {
        ...comparison,
        args: { ...comparison.args, executable: 'document.cookie' },
      },
      { ...comparison, component: 'DynamicCode' },
      { ...comparison, result: '<h1>untrusted markup</h1>' },
      {
        ...comparison,
        args: { configurationIds: matrix.configurations.map(({ id }) => id) },
      },
      { ...comparison, args: { ...comparison.args, attributes: [] } },
      { ...comparison, type: 'custom' },
    ];
    for (const tile of invalidTiles) {
      expect(vehicleWorkspaceSchema.safeParse(modelWith([tile])).success).toBe(
        false,
      );
    }
    expect(
      vehicleWorkspaceSchema.safeParse({ ...valid, html: '<p>extra</p>' })
        .success,
    ).toBe(false);
    expect(
      vehicleWorkspaceSchema.safeParse(
        workspace(Array.from({ length: 5 }, () => comparison)),
      ).success,
    ).toBe(false);
  });

  it('requires the aggregate status to describe successful, failed, and unavailable tiles', () => {
    const failed: VehicleWorkspaceTile = {
      ...comparison,
      result: {
        status: 'ERROR',
        message: 'Please try again.',
        retryable: true,
      },
    };
    const unavailable: VehicleWorkspaceTile = {
      ...reviews,
      result: {
        status: 'UNAVAILABLE',
        message: 'Index unavailable.',
        items: [],
        projectionVersion: null,
      },
    };
    expect(
      vehicleWorkspaceSchema.safeParse(workspace([failed, catalog])).success,
    ).toBe(false);
    expect(
      vehicleWorkspaceSchema.safeParse({
        ...workspace([failed, catalog]),
        status: 'PARTIAL',
      }).success,
    ).toBe(true);
    expect(
      vehicleWorkspaceSchema.safeParse({
        ...workspace([failed, unavailable]),
        status: 'ERROR',
      }).success,
    ).toBe(true);
    expect(
      vehicleWorkspaceSchema.safeParse({
        ...workspace([catalog]),
        status: 'PARTIAL',
      }).success,
    ).toBe(false);
  });

  it('recovers safely from malformed or incomplete result JSON', () => {
    for (const result of [undefined, '', '{"operations":[', 'null', '[]']) {
      expect(parseResult(result, vehicleWorkspaceSchema)).toBeUndefined();
    }
  });
});
