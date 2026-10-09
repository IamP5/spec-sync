import type { ReactElement } from 'react';

import type { ChatCardActions, ToolCallView } from '../../data/tool-call';
import { ChatKnowledgeResultOverview } from './chat-knowledge-result-overview';
import { ChatVehicleCatalogOverview } from './chat-vehicle-catalog-overview';
import { ChatVehicleComparisonOverview } from './chat-vehicle-comparison-overview';
import { ChatVehicleResearchOverview } from './chat-vehicle-research-overview';
import { ChatVehicleSourceOverview } from './chat-vehicle-source-overview';
import { ChatVehicleWorkspaceOverview } from './chat-vehicle-workspace-overview';

/** Props every registered tool component receives. */
export interface ToolAdapterProps {
  call: ToolCallView;
  actions: ChatCardActions;
}

export type ToolAdapter = (props: ToolAdapterProps) => ReactElement | null;

/**
 * Tool name → the component that renders its result (the mobile side of the
 * web `chat-tools.ts` registrations). One registered component per tool
 * result; a tool without an entry renders the generic activity card.
 * See docs/adr/0001-agentic-ui-contracts.md.
 */
export const TOOL_ADAPTERS: Readonly<Record<string, ToolAdapter>> = {
  compareVehicleConfigurations: ChatVehicleComparisonOverview,
  discoverVehicleContent: ChatKnowledgeResultOverview,
  discoverVehicleSpecificationSources: ChatKnowledgeResultOverview,
  findConfigurationsByCapabilities: ChatKnowledgeResultOverview,
  getEvidenceExcerpt: ChatKnowledgeResultOverview,
  getRelatedReviews: ChatKnowledgeResultOverview,
  getVehicleResearch: ChatVehicleResearchOverview,
  getVehicleSpecifications: ChatVehicleComparisonOverview,
  listComparisonAttributes: ChatKnowledgeResultOverview,
  previewVehicleSource: ChatVehicleSourceOverview,
  renderVehicleWorkspace: ChatVehicleWorkspaceOverview,
  replayVehicleResearch: ChatVehicleResearchOverview,
  researchVehicleSpecifications: ChatVehicleResearchOverview,
  resolveComparisonConcepts: ChatKnowledgeResultOverview,
  reviewVehicleResearch: ChatVehicleResearchOverview,
  searchReviewEvidence: ChatKnowledgeResultOverview,
  searchVehicleConfigurations: ChatVehicleCatalogOverview,
};
