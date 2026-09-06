export const loadVehicleIngestionPage = () =>
  import('./vehicle-ingestion-page').then(
    (module) => module.VehicleIngestionPage,
  );
