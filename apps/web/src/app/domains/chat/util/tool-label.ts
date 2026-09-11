/** Business-facing labels; protocol names remain available in activity details. */
const TOOL_LABELS: Readonly<Record<string, string>> = {
  skill: $localize`Reading the research procedure`,
  searchVehicleConfigurations: $localize`Searching vehicle configurations`,
  listComparisonAttributes: $localize`Finding available specifications`,
  resolveComparisonConcepts: $localize`Matching specification terminology`,
  compareVehicleConfigurations: $localize`Comparing vehicles and sources`,
  getVehicleSpecifications: $localize`Reading vehicle specifications`,
  findConfigurationsByCapabilities: $localize`Finding vehicles with this equipment`,
  searchReviewEvidence: $localize`Finding review evidence`,
  getRelatedReviews: $localize`Finding related reviews`,
  getEvidenceExcerpt: $localize`Reading source evidence`,
  discoverVehicleContent: $localize`Finding articles and videos`,
  discoverVehicleSpecificationSources: $localize`Finding specification sources`,
  previewVehicleSource: $localize`Checking the source document`,
  prepareVehicleIngestion: $localize`Preparing a specification import`,
  startVehicleIngestion: $localize`Waiting for import confirmation`,
  researchVehicleSpecifications: $localize`Researching vehicle specifications`,
  getVehicleResearch: $localize`Checking research progress`,
  replayVehicleResearch: $localize`Updating the research interpretation`,
  reviewVehicleResearch: $localize`Opening research for review`,
  renderVehicleWorkspace: $localize`Building your research workspace`,
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? $localize`Working on your request`;
}

/**
 * How a tool call ended, as the activity disclosure reports it. The code is
 * the contract — it is what the transcript compares and what `data-status`
 * exposes — so it stays in English while `toolStatusLabel` translates it.
 */
export type ToolStatus =
  | 'running'
  | 'incomplete'
  | 'completed'
  | 'partial'
  | 'empty'
  | 'failed';

export function toolStatusLabel(status: ToolStatus): string {
  switch (status) {
    case 'running':
      return $localize`Running`;
    case 'incomplete':
      return $localize`Incomplete`;
    case 'completed':
      return $localize`Completed`;
    case 'partial':
      return $localize`Partially completed`;
    case 'empty':
      return $localize`No matches`;
    case 'failed':
      return $localize`Failed`;
  }
}
