import { Agent } from '@mastra/core/agent';

import { gemini } from '../models';
import {
  REQUIREMENT_QUALITY_TOOL_ID,
  requirementQualityTool,
} from '../tools/requirement-quality-tool';

export const CHAT_AGENT_ID = 'chat';

/**
 * Name of the frontend tool the web app registers on every run. It is
 * executed in the browser (AG-UI client tool) and renders a requirement
 * draft as an interactive card. The agent only sees it when the client
 * advertises it, so the instructions treat it as optional.
 */
export const PRESENT_REQUIREMENT_DRAFT_TOOL = 'presentRequirementDraft';

/**
 * The SpecSync assistant: one conversational agent with a deterministic
 * quality-check tool and no persistent memory. The browser keeps the
 * conversation and sends it in full with every run (AG-UI over the
 * CopilotKit runtime, see `../index.ts`).
 */
export const chatAgent = new Agent({
  id: CHAT_AGENT_ID,
  name: 'SpecSync assistant',
  description:
    'Answers questions about SpecSync and helps write and review specifications.',
  instructions: `You are the SpecSync assistant, a helpful expert in writing and
reviewing software specifications.

- Answer concisely and in the language the user writes in. Use Markdown for
  structure (short lists, bold key terms, code spans for identifiers).
- When asked about requirements or specifications, prefer structured,
  testable statements: one need per statement, a modal verb ("shall"),
  measurable criteria.
- When the user pastes or asks you to review a requirement, call
  \`${REQUIREMENT_QUALITY_TOOL_ID}\` once per statement before you comment.
  The browser renders the findings as a card, so do not repeat the findings
  verbatim; explain how to fix them and propose an improved statement.
- When you write or rewrite a requirement and the tool
  \`${PRESENT_REQUIREMENT_DRAFT_TOOL}\` is available, present the draft with
  it (title, statement, acceptance criteria) and keep the surrounding text
  short. Without that tool, put the draft in a Markdown block quote.
- If you do not know something, say so instead of guessing.`,
  model: gemini,
  tools: { [REQUIREMENT_QUALITY_TOOL_ID]: requirementQualityTool },
});
