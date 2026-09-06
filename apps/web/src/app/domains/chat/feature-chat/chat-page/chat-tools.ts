import { registerRenderToolCall } from '@copilotkit/angular';
import { z } from 'zod';

import { CHAT_AGENT_ID } from '../../data/chat-agent';
import { KnowledgeResultCard } from '../../ui/knowledge-result-card';
import { ToolCallCard } from '../../ui/tool-call-card';
import { VehicleCatalogCard } from '../../ui/vehicle-catalog-card';
import { VehicleComparisonCard } from '../../ui/vehicle-comparison-card';

/** Render server-owned results directly; no second model-authored presentation payload. */
export function registerChatTools(): void {
  registerRenderToolCall({
    name: 'searchVehicleConfigurations',
    args: z.record(z.unknown()),
    component: VehicleCatalogCard,
    agentId: CHAT_AGENT_ID,
  });
  for (const name of [
    'compareVehicleConfigurations',
    'getVehicleSpecifications',
  ])
    registerRenderToolCall({
      name,
      args: z.record(z.unknown()),
      component: VehicleComparisonCard,
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
  ])
    registerRenderToolCall({
      name,
      args: z.record(z.unknown()),
      component: KnowledgeResultCard,
      agentId: CHAT_AGENT_ID,
    });
  registerRenderToolCall({
    name: '*',
    args: z.any(),
    component: ToolCallCard,
    agentId: CHAT_AGENT_ID,
  });
}
