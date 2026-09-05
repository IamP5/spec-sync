import { describe, expect, it } from 'vitest';

import { REQUIREMENT_QUALITY_TOOL_ID } from '../tools/requirement-quality-tool';
import {
  CHAT_AGENT_ID,
  chatAgent,
  PRESENT_REQUIREMENT_DRAFT_TOOL,
} from './chat-agent';

describe('chatAgent', () => {
  it('is registered under the id the web app runs through the runtime', () => {
    expect(chatAgent.id).toBe(CHAT_AGENT_ID);
    expect(CHAT_AGENT_ID).toBe('chat');
  });

  it('carries instructions for the assistant persona and its tools', async () => {
    const instructions = JSON.stringify(await chatAgent.getInstructions());
    expect(instructions).toContain('SpecSync assistant');
    expect(instructions).toContain(REQUIREMENT_QUALITY_TOOL_ID);
    expect(instructions).toContain(PRESENT_REQUIREMENT_DRAFT_TOOL);
  });

  it('requests provider thinking summaries for the AG-UI stream', async () => {
    const options = await chatAgent.getDefaultOptions();
    expect(options.providerOptions).toEqual({
      google: { thinkingConfig: { includeThoughts: true } },
    });
  });

  it('owns the requirement quality tool', async () => {
    const tools = await chatAgent.listTools();
    expect(Object.keys(tools)).toContain(REQUIREMENT_QUALITY_TOOL_ID);
  });
});
