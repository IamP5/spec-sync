/** Business-facing labels; protocol names remain available in activity details. */
const TOOL_LABELS: Readonly<Record<string, string>> = {
  skill: 'Reading the research procedure',
  searchVehicleConfigurations: 'Searching vehicle configurations',
  listComparisonAttributes: 'Finding available specifications',
  resolveComparisonConcepts: 'Matching specification terminology',
  compareVehicleConfigurations: 'Comparing vehicles and sources',
  getVehicleSpecifications: 'Reading vehicle specifications',
  findConfigurationsByCapabilities: 'Finding vehicles with this equipment',
  searchReviewEvidence: 'Finding review evidence',
  getRelatedReviews: 'Finding related reviews',
  getEvidenceExcerpt: 'Reading source evidence',
  discoverVehicleContent: 'Finding articles and videos',
  discoverVehicleSpecificationSources: 'Finding specification sources',
  previewVehicleSource: 'Checking the source document',
  prepareVehicleIngestion: 'Preparing a specification import',
  startVehicleIngestion: 'Waiting for import confirmation',
  researchVehicleSpecifications: 'Researching vehicle specifications',
  getVehicleResearch: 'Checking research progress',
  replayVehicleResearch: 'Updating the research interpretation',
  reviewVehicleResearch: 'Opening research for review',
  renderVehicleWorkspace: 'Building your research workspace',
  renderCompetitiveWorkspace: 'Updating competitive analysis',
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? 'Working on your request';
}
