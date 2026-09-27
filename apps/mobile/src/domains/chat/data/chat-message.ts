import type { Message } from '@ag-ui/client';

/** A transcript line as the chat screen shows it. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

/**
 * The user and assistant text of an AG-UI transcript, in order. Tool calls
 * and tool results are not rendered yet; they will get their own registered
 * components (docs/adr/0001-agentic-ui-contracts.md), never text made up here.
 * Markdown stays plain text.
 */
export function chatMessagesOf(messages: readonly Message[]): ChatMessage[] {
  const lines: ChatMessage[] = [];
  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    const text = textOf(message.content).trim();
    if (text) lines.push({ id: message.id, role: message.role, text });
  }
  return lines;
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part: unknown) =>
      typeof part === 'object' &&
      part !== null &&
      'type' in part &&
      part.type === 'text' &&
      'text' in part &&
      typeof part.text === 'string'
        ? part.text
        : '',
    )
    .join('');
}
