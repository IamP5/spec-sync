import { describe, expect, it } from 'vitest';

import { CHAT_AGENT_ID, chatAgent } from './chat-agent';

describe('chatAgent', () => {
  it('is registered under the id the web app streams from', () => {
    expect(chatAgent.id).toBe(CHAT_AGENT_ID);
    expect(CHAT_AGENT_ID).toBe('chat');
  });

  it('carries instructions for the assistant persona', async () => {
    const instructions = await chatAgent.getInstructions();
    expect(JSON.stringify(instructions)).toContain('SpecSync assistant');
  });
});
