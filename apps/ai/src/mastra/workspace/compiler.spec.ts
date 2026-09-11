import { describe, expect, it } from 'vitest';

import { compileVehicleWorkspace } from './compiler';
import {
  type ResolvedWorkspaceTile,
  VEHICLE_WORKSPACE_CATALOG,
  vehicleWorkspaceOutputSchema,
} from './contracts';

const surfaceId = 'workspace-f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
const catalog: ResolvedWorkspaceTile = {
  type: 'catalog',
  title: 'Available configurations',
  args: { q: 'Ranger', limit: 6, offset: 0 },
  result: { items: [], limit: 6, offset: 0, hasMore: false },
};
const reviews: ResolvedWorkspaceTile = {
  type: 'reviews',
  title: 'Stored review evidence',
  args: {
    configurationId: 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
    q: '',
    limit: 4,
  },
  result: {
    status: 'EMPTY',
    message: 'No stored review passages.',
    projectionVersion: 'r12',
    items: [],
  },
};

describe('deterministic A2UI workspace compilation', () => {
  it('separates a fixed allowlisted layout from unchanged factual bindings', () => {
    const tiles = [catalog, reviews];
    const output = compileVehicleWorkspace('Truck research', tiles, surfaceId);
    expect(output).toEqual(
      compileVehicleWorkspace('Truck research', tiles, surfaceId),
    );
    expect(output.status).toBe('OK');
    expect(output.operations[0]).toEqual({
      version: 'v0.9',
      createSurface: { surfaceId, catalogId: VEHICLE_WORKSPACE_CATALOG },
    });
    expect(output.operations[1]).toEqual({
      version: 'v0.9',
      updateComponents: {
        surfaceId,
        components: [
          { id: 'root', component: 'Column', children: ['tile-0', 'tile-1'] },
          {
            id: 'tile-0',
            component: 'VehicleCatalog',
            data: { path: '/tiles/0' },
          },
          {
            id: 'tile-1',
            component: 'VehicleEvidence',
            data: { path: '/tiles/1' },
          },
        ],
      },
    });
    expect(output.operations[2].updateDataModel.value.tiles).toBe(tiles);
    expect(vehicleWorkspaceOutputSchema.parse(output)).toEqual(output);
  });

  it('keeps missing evidence distinct from failed retrieval', () => {
    const failed: ResolvedWorkspaceTile = {
      ...reviews,
      result: {
        status: 'ERROR',
        message: 'Catalog unavailable',
        retryable: true,
      },
    };
    const unavailable: ResolvedWorkspaceTile = {
      ...reviews,
      result: {
        status: 'UNAVAILABLE',
        message: 'Index unavailable',
        projectionVersion: null,
        items: [],
      },
    };
    expect(
      compileVehicleWorkspace('Trucks', [catalog, reviews], surfaceId).status,
    ).toBe('OK');
    expect(
      compileVehicleWorkspace('Trucks', [catalog, failed], surfaceId).status,
    ).toBe('PARTIAL');
    expect(
      compileVehicleWorkspace('Trucks', [failed, unavailable], surfaceId)
        .status,
    ).toBe('ERROR');
  });

  it('rejects unrecognized catalog versions and executable component names', () => {
    const output = compileVehicleWorkspace(
      'Truck research',
      [catalog],
      surfaceId,
    );
    const unknownCatalog = structuredClone(output);
    Object.assign(unknownCatalog.operations[0].createSurface, {
      catalogId: 'urn:untrusted',
    });
    expect(vehicleWorkspaceOutputSchema.safeParse(unknownCatalog).success).toBe(
      false,
    );
    const unknownComponent = structuredClone(output);
    Object.assign(
      unknownComponent.operations[1].updateComponents.components[1] ?? {},
      { component: 'iframe' },
    );
    expect(
      vehicleWorkspaceOutputSchema.safeParse(unknownComponent).success,
    ).toBe(false);
  });
});
