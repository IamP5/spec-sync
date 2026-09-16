import type {
  IngestionStartArgs,
  VehicleConfiguration,
  VehicleQuestion,
} from '../../../vehicles/api/contracts';

export function vehicleComparisonPrompt(
  vehicles: VehicleConfiguration[],
): string {
  return `Compare these exact catalog configurations: ${vehicles.map((vehicle) => `${vehicle.brand} ${vehicle.model} ${vehicle.name} (${vehicle.id})`).join('; ')}. Use their configuration IDs and preserve missing, conflicting, optional, provisional, qualified, and dated facts.`;
}

/**
 * The prompt a vehicle card hands to the chat. Every branch is *drafted*
 * into the composer, so the user reads and edits it: they are translated.
 */
export function vehicleQuestionPrompt(question: VehicleQuestion): string {
  switch (question.kind) {
    case 'vehicle': {
      const vehicle = question.vehicle;
      const name = `${vehicle.brand} ${vehicle.model} ${vehicle.name}`;
      const scope = `${vehicle.market} ${vehicle.modelYear}`;
      const id = vehicle.id;
      return $localize`Tell me more about ${name}:vehicle:, ${scope}:scope: (configuration ID ${id}:id:). Preserve unknowns, conflicts, qualifiers, and evidence.`;
    }
    case 'comparison': {
      const configurations = question.configurations
        .map((c) => `${c.brand} ${c.model} ${c.name} (${c.id})`)
        .join('; ');
      const attributes = question.attributeCodes.join(', ');
      return $localize`For the configurations ${configurations}:configurations:, explain the practical implications of the differences in ${attributes}:attributes:. Consider my use: `;
    }
    case 'reviews': {
      // Only stable IDs cross into a prompt; never copy untrusted review passages.
      const attribute = question.attributeCode;
      const configurations = question.configurationIds.join(', ');
      const evidence = question.evidenceIds.join(', ');
      const observations = question.observationIds.join(', ');
      return $localize`Analyse the selected reports about ${attribute}:attribute: for the configurations ${configurations}:configurations:. Look the passages up by their evidence IDs: ${evidence}:evidence:. Selected observations: ${observations}:observations:. Explain agreements, disagreements and the limits of applicability for each version. Keep opinions separate from technical specifications.`;
    }
    case 'discover': {
      const attribute = question.attributeLabel;
      const configurations = question.configurations
        .map(
          (c) =>
            `${c.brand} ${c.model} ${c.name}, ${c.market} ${c.modelYear} (ID ${c.id})`,
        )
        .join('; ');
      return $localize`Find articles, blogs and videos about ${attribute}:attribute: for ${configurations}:configurations:. Distinguish discovered links from reviews that are already verified.`;
    }
  }
}

/** Asks the agent to start an import for the configurations the curator ticked in a source preview. */
export function vehicleIngestionPrompt(scope: IngestionStartArgs): string {
  const configurations = scope.configurations.length
    ? `these configurations: ${scope.configurations.join('; ')}`
    : 'every configuration the source presents';
  return `Start a reviewed specification import for ${scope.brand} ${scope.model} ${scope.modelYear} (market BR) from ${scope.sourceUrl}, importing ${configurations}. Use startVehicleIngestion; I will confirm and enter the curator key in the browser.`;
}
