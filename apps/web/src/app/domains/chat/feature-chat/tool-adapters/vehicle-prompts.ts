import type {
  CatalogPage,
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
 * Asks for the next page of the catalog search that produced a rendered page.
 * `args` are the arguments of that search tool call, so the page keeps the
 * same query, market and model year.
 */
export function catalogPagePrompt(
  question: Extract<VehicleQuestion, { kind: 'catalog-page' }>,
  args: Record<string, unknown> = {},
  nextSearches?: CatalogPage['nextSearches'],
): string {
  if (nextSearches?.length)
    return `Show the next catalog page for these searches. Call searchVehicleConfigurations once with ${JSON.stringify({ searches: nextSearches })}. Its result renders one catalog containing all returned vehicles.`;
  const scope = ['q', 'market', 'modelYear']
    .filter((key) => args[key] !== undefined && args[key] !== '')
    .map((key) => `${key} ${JSON.stringify(args[key])}`);
  return `Show the next page of the vehicle catalog: up to ${question.limit} configurations from offset ${question.offset}${scope.length ? `, keeping the same search (${scope.join(', ')})` : ''}. Call searchVehicleConfigurations with exactly this offset and limit and render the result as the catalog.`;
}

/**
 * The prompt a vehicle card hands to the chat. Every branch except
 * `catalog-page` is *drafted* into the composer, so the user reads and edits
 * it: those are translated. `catalog-page` is sent straight through and names
 * a tool with its arguments, so it stays in the source language where the
 * wording is part of the contract with the agent.
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
    case 'catalog-page':
      return catalogPagePrompt(question);
  }
}

/** Asks the agent to start an import for the configurations the curator ticked in a source preview. */
export function vehicleIngestionPrompt(scope: IngestionStartArgs): string {
  const configurations = scope.configurations.length
    ? `these configurations: ${scope.configurations.join('; ')}`
    : 'every configuration the source presents';
  return `Start a reviewed specification import for ${scope.brand} ${scope.model} ${scope.modelYear} (market BR) from ${scope.sourceUrl}, importing ${configurations}. Use startVehicleIngestion; I will confirm and enter the curator key in the browser.`;
}
