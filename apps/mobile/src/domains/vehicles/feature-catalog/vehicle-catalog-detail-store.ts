import { queryOptions, useQuery } from '@tanstack/react-query';

import { loadSpecifications } from '../data/vehicle-catalog-client';

export const vehicleSpecificationsQuery = (
  configurationId: string | undefined,
) =>
  queryOptions({
    queryKey: ['vehicles', 'catalog', 'detail', configurationId],
    queryFn: ({ signal }) =>
      // `enabled` keeps the query idle until a configuration is chosen.
      loadSpecifications(configurationId ?? '', signal),
    enabled: configurationId !== undefined,
  });

/** The sourced specifications of the configuration opened in the detail sheet. */
export function useVehicleCatalogDetailStore(
  configurationId: string | undefined,
) {
  const detail = useQuery(vehicleSpecificationsQuery(configurationId));
  return {
    detail: detail.data,
    detailLoading: detail.isLoading,
    detailFailed: detail.isError,
    retry(): void {
      void detail.refetch();
    },
  };
}
