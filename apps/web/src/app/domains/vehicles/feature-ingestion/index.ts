export { VehicleIngestionLaunchEdit } from './vehicle-ingestion-launch-edit';
export { VehicleIngestionReviewDetail } from './vehicle-ingestion-review-detail';
export { VehicleIngestionRunDetail } from './vehicle-ingestion-run-detail';
export { VehicleIngestionSearch } from './vehicle-ingestion-search';

/** Keep the routed page lazy; the chat composes the entries above eagerly. */
export const loadVehicleIngestionPage = () =>
  import('./vehicle-ingestion-page').then(
    (module) => module.VehicleIngestionPage,
  );
