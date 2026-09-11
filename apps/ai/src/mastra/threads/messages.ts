import type { AssistantMessage, Message, ToolMessage } from '@ag-ui/core';
import type {
  MastraDBMessage,
  MastraMessagePart,
} from '@mastra/core/agent/message-list';

import { canonicalHistory } from './canonical-history';

export const CONTINUATION_SUFFIX = '-agui-text';

export function continuationIdOf(id: string): string {
  return `${id}${CONTINUATION_SUFFIX}`;
}

export function toAGUIMessages(stored: MastraDBMessage[]): Message[] {
  return canonicalHistory(stored).flatMap((message) =>
    message.role === 'user'
      ? userMessagesOf(message)
      : message.role === 'assistant'
        ? assistantMessagesOf(message)
        : [],
  );
}

function userMessagesOf(message: MastraDBMessage): Message[] {
  const content = textOf(message.content.parts ?? []);
  return content ? [{ id: message.id, role: 'user', content }] : [];
}

interface AssistantGroup {
  message: AssistantMessage;
  results: ToolMessage[];
}

function assistantMessagesOf(message: MastraDBMessage): Message[] {
  const reasoning: Message[] = [];
  let group: AssistantGroup = {
    message: { id: message.id, role: 'assistant', content: '' },
    results: [],
  };
  const groups: AssistantGroup[] = [group];
  let afterTool = false;

  for (const part of message.content.parts ?? []) {
    if (part.type === 'text') {
      if (afterTool && group.message.id === message.id) {
        group = {
          message: {
            id: continuationIdOf(message.id),
            role: 'assistant',
            content: '',
          },
          results: [],
        };
        groups.push(group);
      }
      group.message.content = `${group.message.content ?? ''}${part.text}`;
      continue;
    }
    if (part.type === 'reasoning') {
      const content = reasoningTextOf(part);
      if (content) {
        reasoning.push({
          id: `${message.id}-reasoning-${reasoning.length}`,
          role: 'reasoning',
          content,
        });
      }
      continue;
    }
    if (part.type === 'tool-invocation') {
      const call = part.toolInvocation;
      afterTool = true;
      group.message.toolCalls = [
        ...(group.message.toolCalls ?? []),
        {
          id: call.toolCallId,
          type: 'function',
          function: {
            name: call.toolName,
            arguments: stringify(call.args ?? {}),
          },
        },
      ];
      if (call.state === 'result') {
        group.results.push({
          id: `${call.toolCallId}-result`,
          role: 'tool',
          toolCallId: call.toolCallId,
          content: stringify(call.result),
          ...(call.isError
            ? { error: call.errorText ?? 'The tool reported a failure.' }
            : {}),
        });
      }
    }
  }

  return [
    ...reasoning,
    ...groups
      .filter(
        (entry) => entry.message.content || entry.message.toolCalls?.length,
      )
      .flatMap((entry) => [entry.message, ...entry.results]),
  ];
}

function textOf(parts: MastraMessagePart[]): string {
  return parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .filter(Boolean)
    .join('\n');
}

function reasoningTextOf(part: MastraMessagePart): string {
  if (part.type !== 'reasoning') {
    return '';
  }
  const reasoning = (part as { reasoning?: unknown }).reasoning;
  if (typeof reasoning === 'string') {
    return reasoning;
  }
  const details = (part as { details?: unknown }).details;
  return Array.isArray(details)
    ? details
        .map((detail: unknown) =>
          typeof detail === 'object' &&
          detail !== null &&
          'text' in detail &&
          typeof detail.text === 'string'
            ? detail.text
            : '',
        )
        .filter(Boolean)
        .join('')
    : '';
}

function stringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value ?? null) ?? '';
  } catch {
    return '';
  }
}
