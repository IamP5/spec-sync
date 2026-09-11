import {
  type ResolvedWorkspaceTile,
  VEHICLE_WORKSPACE_CATALOG,
  type VehicleWorkspaceOutput,
} from './contracts';

const components = {
  catalog: 'VehicleCatalog',
  comparison: 'VehicleComparison',
  specifications: 'VehicleComparison',
  reviews: 'VehicleEvidence',
} as const;

/** Layout is deterministic; all factual data is retained in separate bindings. */
export function compileVehicleWorkspace(
  title: string,
  tiles: ResolvedWorkspaceTile[],
  surfaceId: string,
): VehicleWorkspaceOutput {
  const failures = tiles.filter(
    ({ result }) =>
      'status' in result &&
      (result.status === 'ERROR' || result.status === 'UNAVAILABLE'),
  ).length;
  return {
    status:
      failures === 0 ? 'OK' : failures === tiles.length ? 'ERROR' : 'PARTIAL',
    title,
    operations: [
      {
        version: 'v0.9',
        createSurface: { surfaceId, catalogId: VEHICLE_WORKSPACE_CATALOG },
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
              component: components[tile.type],
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
