import { queryOptions, useQuery } from '@tanstack/react-query';

import { loadImages } from '../data/vehicle-catalog-client';

export const comparisonImagesQuery = (configurationIds: readonly string[]) =>
  queryOptions({
    queryKey: ['vehicles', 'comparison', 'images', configurationIds],
    queryFn: ({ signal }) => loadImages(configurationIds, signal),
    enabled: configurationIds.length > 0,
  });

/**
 * Photos for compared configurations saved without one (web
 * `VehicleComparisonLookupStore`). A failed lookup leaves the comparison as
 * it is: the image frames fall back to the car icon.
 */
export function useVehicleComparisonLookupStore(
  configurationIds: readonly string[],
) {
  const images = useQuery(comparisonImagesQuery(configurationIds));
  return { images: images.data };
}
