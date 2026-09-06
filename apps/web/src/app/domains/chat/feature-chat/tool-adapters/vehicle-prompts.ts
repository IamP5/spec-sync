import type {
  VehicleConfiguration,
  VehicleQuestion,
} from '../../../vehicles/api/contracts';

export function vehicleComparisonPrompt(
  vehicles: VehicleConfiguration[],
): string {
  return `Compare these exact catalog configurations: ${vehicles.map((vehicle) => `${vehicle.brand} ${vehicle.model} ${vehicle.name} (${vehicle.id})`).join('; ')}. Use their configuration IDs and preserve missing, conflicting, optional, provisional, qualified, and dated facts.`;
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
  }
}
