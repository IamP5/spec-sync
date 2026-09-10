import {
  registerHumanInTheLoop,
  registerRenderToolCall,
} from '@copilotkit/angular';
import { z } from 'zod';

import { ingestionStartArgsSchema } from '../../../vehicles/api/contracts';
import { CHAT_AGENT_ID } from '../../data/chat-agent';
import { ChatVehicleCatalogOverview } from '../tool-adapters/chat-vehicle-catalog-overview';
import { ChatVehicleComparisonOverview } from '../tool-adapters/chat-vehicle-comparison-overview';
import { ChatVehicleIngestionEdit } from '../tool-adapters/chat-vehicle-ingestion-edit';
import { ChatVehicleIngestionPlanEdit } from '../tool-adapters/chat-vehicle-ingestion-plan-edit';
import { ChatVehicleResearchDetail } from '../tool-adapters/chat-vehicle-research-detail';
import { ChatVehicleSourceOverview } from '../tool-adapters/chat-vehicle-source-overview';
import { KnowledgeResultCard } from '../ui/knowledge-result-card';
import { ToolCallCard } from '../ui/tool-call-card';

/**
 * Name of the browser tool the agent calls to start an import. The curator
 * confirms the scope and enters the key in the rendered card; the agent
 * only receives the run id and status. Part of the contract with `apps/ai`
 * (the agent instructions and the vehicle-ingestion skill name it).
 */
export const START_INGESTION_TOOL = 'startVehicleIngestion';

/** Render server-owned results directly; no second model-authored presentation payload. */
export function registerChatTools(): void {
  for (const name of [
    'researchVehicleSpecifications',
    'getVehicleResearch',
    'replayVehicleResearch',
    'reviewVehicleResearch',
  ])
    registerRenderToolCall({
      name,
      args: z.record(z.unknown()),
      component: ChatVehicleResearchDetail,
      agentId: CHAT_AGENT_ID,
    });
  registerRenderToolCall({
    name: 'searchVehicleConfigurations',
    args: z.record(z.unknown()),
    component: ChatVehicleCatalogOverview,
    agentId: CHAT_AGENT_ID,
  });
  for (const name of [
    'compareVehicleConfigurations',
    'getVehicleSpecifications',
  ])
    registerRenderToolCall({
      name,
      args: z.record(z.unknown()),
      component: ChatVehicleComparisonOverview,
      agentId: CHAT_AGENT_ID,
    });
  for (const name of [
    'listComparisonAttributes',
    'resolveComparisonConcepts',
    'findConfigurationsByCapabilities',
    'searchReviewEvidence',
    'getRelatedReviews',
    'getEvidenceExcerpt',
    'discoverVehicleContent',
    'discoverVehicleSpecificationSources',
  ])
    registerRenderToolCall({
      name,
      args: z.record(z.unknown()),
      component: KnowledgeResultCard,
      agentId: CHAT_AGENT_ID,
    });
  registerRenderToolCall({
    name: 'previewVehicleSource',
    args: z.record(z.unknown()),
    component: ChatVehicleSourceOverview,
    agentId: CHAT_AGENT_ID,
  });
  registerRenderToolCall({
    name: 'prepareVehicleIngestion',
    args: z.record(z.unknown()),
    component: ChatVehicleIngestionPlanEdit,
    agentId: CHAT_AGENT_ID,
  });
  registerHumanInTheLoop({
    name: START_INGESTION_TOOL,
    description:
      'Legacy standalone ingestion only. Never use for existing or new chat research: use researchVehicleSpecifications followed by reviewVehicleResearch, which requires no curator key. The curator confirms the scope and enters the curator key there; you receive the run id and status. Call it after the source and configurations are agreed. Arguments: sourceUrl (official manufacturer HTML page or PDF), brand, model, modelYear, configurations (names to import; empty imports every configuration the source presents, up to 8).',
    parameters: ingestionStartArgsSchema,
    component: ChatVehicleIngestionEdit,
    agentId: CHAT_AGENT_ID,
  });
  registerRenderToolCall({
    name: '*',
    args: z.any(),
    component: ToolCallCard,
    agentId: CHAT_AGENT_ID,
  });
}
