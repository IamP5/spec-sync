import { Agent } from '@mastra/core/agent';

import { gemini } from '../models';

export const CHAT_AGENT_ID = 'chat';

/**
 * The SpecSync assistant: a single conversational agent without tools or
 * persistent memory. The browser keeps the conversation and sends it in full
 * with every request.
 */
export const chatAgent = new Agent({
  id: CHAT_AGENT_ID,
  name: 'SpecSync assistant',
  description:
    'Answers questions about SpecSync and helps write specifications.',
  instructions: `You are the SpecSync assistant, a helpful expert in writing and
reviewing software specifications.

- Answer concisely and in the language the user writes in.
- When asked about requirements or specifications, prefer structured,
  testable statements.
- If you do not know something, say so instead of guessing.`,
  model: gemini,
});
