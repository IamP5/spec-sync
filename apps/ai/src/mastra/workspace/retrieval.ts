import { randomUUID } from 'node:crypto';

import { catalogRequest, withToolFailure } from '../catalog/api-client';
import { comparisonSchema } from '../catalog/contracts';
import { retrieveReviews } from '../catalog/review-search';
import { compileVehicleWorkspace } from './compiler';
import {
  type ResolvedWorkspaceTile,
  type VehicleWorkspaceInput,
  vehicleWorkspaceInputSchema,
  workspaceCatalogPageSchema,
} from './contracts';

/** Per-invocation requests are bounded by the four-tile DSL and deduplicated. */
export async function retrieveVehicleWorkspace(
  input: VehicleWorkspaceInput,
  signal?: AbortSignal,
  surfaceId = `workspace-${randomUUID()}`,
) {
  const definition = vehicleWorkspaceInputSchema.parse(input);
  signal?.throwIfAborted();
  const pending = new Map<string, Promise<ResolvedWorkspaceTile>>();
  const tiles = await Promise.all(
    definition.tiles.map(async (tile) => {
      const { title, ...request } = tile;
      const key = JSON.stringify(request);
      let resolution = pending.get(key);
      if (!resolution) {
        resolution = retrieveTile(tile, signal);
        pending.set(key, resolution);
      }
      const resolved = await resolution;
      signal?.throwIfAborted();
      return { ...resolved, title };
    }),
  );
  return compileVehicleWorkspace(definition.title, tiles, surfaceId);
}

async function retrieveTile(
  tile: VehicleWorkspaceInput['tiles'][number],
  signal?: AbortSignal,
): Promise<ResolvedWorkspaceTile> {
  signal?.throwIfAborted();
  switch (tile.type) {
    case 'catalog': {
      const { type, title, ...search } = tile;
      const args = { ...search, offset: 0 as const };
      const result = await withToolFailure(() =>
        catalogRequest(
          '/api/vehicle-configurations',
          args,
          workspaceCatalogPageSchema,
          signal,
        ),
      );
      return { type, title, args, result };
    }
    case 'comparison': {
      const { type, title, ...args } = tile;
      const result = await withToolFailure(() =>
        catalogRequest('/api/comparisons', args, comparisonSchema, signal),
      );
      return { type, title, args, result };
    }
    case 'specifications': {
      const { type, title, ...args } = tile;
      const result = await withToolFailure(() =>
        catalogRequest(
          '/api/vehicle-specifications',
          args,
          comparisonSchema,
          signal,
        ),
      );
      return { type, title, args, result };
    }
    case 'reviews': {
      const { type, title, ...args } = tile;
      const result = await withToolFailure(() => retrieveReviews(args, signal));
      return { type, title, args, result };
    }
  }
}
