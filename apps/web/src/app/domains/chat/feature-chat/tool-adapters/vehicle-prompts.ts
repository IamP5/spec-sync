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

export function vehicleQuestionPrompt(question: VehicleQuestion): string {
  switch (question.kind) {
    case 'vehicle': {
      const vehicle = question.vehicle;
      return `Tell me more about ${vehicle.brand} ${vehicle.model} ${vehicle.name}, ${vehicle.market} ${vehicle.modelYear} (configuration ID ${vehicle.id}). Preserve unknowns, conflicts, qualifiers, and evidence.`;
    }
    case 'comparison':
      return `Para as configurações ${question.configurations.map((c) => `${c.brand} ${c.model} ${c.name} (${c.id})`).join('; ')}, explique as implicações práticas das diferenças em ${question.attributeCodes.join(', ')}. Considere o meu uso: `;
    case 'reviews':
      // Only stable IDs cross into a prompt; never copy untrusted review passages.
      return `Analise os relatos selecionados sobre ${question.attributeCode} para as configurações ${question.configurationIds.join(', ')}. Consulte os trechos pelos IDs de evidência: ${question.evidenceIds.join(', ')}. Observações selecionadas: ${question.observationIds.join(', ')}. Explique concordâncias, divergências e limites de aplicação a cada versão. Separe opiniões de especificações técnicas.`;
    case 'discover':
      return `Busque artigos, blogs e vídeos sobre ${question.attributeLabel} de ${question.configurations.map((c) => `${c.brand} ${c.model} ${c.name}, ${c.market} ${c.modelYear} (ID ${c.id})`).join('; ')}. Distinga links descobertos de avaliações já verificadas.`;
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
