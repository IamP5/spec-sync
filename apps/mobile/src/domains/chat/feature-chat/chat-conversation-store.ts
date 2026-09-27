import { useAgent, useCopilotKit } from '@copilotkit/react-native/headless';
import { useState } from 'react';

import {
  CHAT_AGENT_ID,
  CHAT_LOCALE,
  CHAT_LOCALE_PROPERTY,
} from '../data/chat-agent';
import { chatMessagesOf } from '../data/chat-message';

/**
 * The conversation with the chat agent: its transcript, whether a run is in
 * progress, and the last run failure. It is the only place in the feature
 * that talks to CopilotKit.
 */
export function useChatConversationStore() {
  // The AG-UI agent mutates its message list in place, so the React Compiler
  // must not memoize values derived from it.
  'use no memo';
  const { agent } = useAgent({ agentId: CHAT_AGENT_ID });
  const { copilotkit } = useCopilotKit();
  const [error, setError] = useState<string>();

  async function send(text: string): Promise<void> {
    const content = text.trim();
    if (!agent || !content || agent.isRunning) return;
    setError(undefined);
    agent.addMessage({
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      role: 'user',
      content,
    });
    try {
      await copilotkit.runAgent({
        agent,
        forwardedProps: { [CHAT_LOCALE_PROPERTY]: CHAT_LOCALE },
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The assistant is unavailable.',
      );
    }
  }

  return {
    ready: agent !== undefined,
    messages: chatMessagesOf(agent?.messages ?? []),
    running: agent?.isRunning ?? false,
    error,
    send,
  };
}
