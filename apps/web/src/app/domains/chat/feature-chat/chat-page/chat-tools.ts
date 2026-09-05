import {
  registerFrontendTool,
  registerRenderToolCall,
} from '@copilotkit/angular';
import { z } from 'zod';

import { CHAT_AGENT_ID } from '../../data/chat-agent';
import {
  PRESENT_REQUIREMENT_DRAFT_TOOL,
  requirementDraftSchema,
} from '../../data/requirement-draft';
import {
  REQUIREMENT_QUALITY_TOOL,
  requirementQualityArgsSchema,
} from '../../data/requirement-quality';
import { RequirementDraftCard } from '../../ui/requirement-draft-card';
import { RequirementQualityCard } from '../../ui/requirement-quality-card';
import { ToolCallCard } from '../../ui/tool-call-card';

/**
 * Registers the generative UI of the chat with the AG-UI client. Call it from
 * an injection context (the chat page's constructor): the registrations are
 * removed again when that injector is destroyed, so the tools only exist
 * while the page is open.
 *
 * - `checkRequirementQuality` runs on the server; the browser renders its
 *   call as a card.
 * - `presentRequirementDraft` is a frontend tool: it is advertised to the
 *   agent on every run, executed here (nothing to compute) and rendered as
 *   a card. The card is the answer, so no follow-up run is requested.
 * - `*` catches every other tool so server-side work stays visible.
 */
export function registerChatTools(): void {
  registerRenderToolCall({
    name: REQUIREMENT_QUALITY_TOOL,
    args: requirementQualityArgsSchema,
    component: RequirementQualityCard,
    agentId: CHAT_AGENT_ID,
  });

  registerFrontendTool({
    name: PRESENT_REQUIREMENT_DRAFT_TOOL,
    description:
      'Presents a requirement you wrote as an interactive card the user can ' +
      'copy. Use it whenever you propose or rewrite a requirement.',
    parameters: requirementDraftSchema,
    component: RequirementDraftCard,
    handler: async () => ({ presented: true }),
    followUp: false,
    agentId: CHAT_AGENT_ID,
  });

  registerRenderToolCall({
    name: '*',
    args: z.any(),
    component: ToolCallCard,
    agentId: CHAT_AGENT_ID,
  });
}
