import {
  VEHICLE_WORKSPACE_CATALOG_ID,
  type VehicleWorkspace,
  type VehicleWorkspaceTile,
} from '../domains/chat/data/vehicle-workspace-contracts';
import { matrix } from './vehicle-fixtures';

export const workspaceSurfaceId =
  'workspace-08e08761-a2e7-5ae5-b2ad-387e93829fb7';

export function workspaceFixture(
  tiles: VehicleWorkspaceTile[] = [
    {
      type: 'comparison',
      title: 'Compare selected configurations',
      args: {
        configurationIds: matrix.configurations.map(({ id }) => id),
        attributes: matrix.rows.map(({ attribute }) => attribute.code),
      },
      result: matrix,
    },
  ],
  surfaceId = workspaceSurfaceId,
): VehicleWorkspace {
  const failed = tiles.filter(
    (tile) =>
      'status' in tile.result &&
      ['ERROR', 'UNAVAILABLE'].includes(tile.result.status ?? ''),
  ).length;
  return {
    status: failed === 0 ? 'OK' : failed === tiles.length ? 'ERROR' : 'PARTIAL',
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
                  ? ('VehicleCatalog' as const)
                  : tile.type === 'reviews'
                    ? ('VehicleEvidence' as const)
                    : ('VehicleComparison' as const),
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
