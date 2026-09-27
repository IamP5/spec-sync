import type { AssistantMessage, Message } from '@ag-ui/client';

import type { ToolStatus } from '../util/tool-label';
import { isChatTurn, textOf, toolActivities } from './chat-agent';
import type { ToolCallView } from './tool-call';
import { type ToolPresentation, toolPresentation } from './tool-presentation';

/** A note the transcript shows instead of a repeated or empty tool card. */
export type ToolNote = ToolPresentation['notes'][number];

/** One tool call as the activity disclosure lists it. */
export interface ToolActivity {
  id: string;
  name: string;
  label: string;
  status: ToolStatus;
  input: string;
  result: string;
}

/** A line of the transcript, in the order the conversation happened. */
export type TranscriptItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'reasoning'; id: string; text: string }
  | {
      kind: 'assistant';
      id: string;
      text: string;
      /** The calls whose registered components render in this turn. */
      toolCalls: ToolCallView[];
      notes: ToolNote[];
      /** Every call of the turn, for the "thinking and tool activity" view. */
      activities: ToolActivity[];
    };

/**
 * The transcript of an AG-UI thread (already `normalizeThread`ed): user text,
 * thinking summaries, assistant text, and the tool calls the display
 * projection (`toolPresentation`) keeps visible, each with its real result.
 * Nothing is merged or made up here (docs/adr/0001-agentic-ui-contracts.md).
 */
export function transcriptOf(
  messages: readonly Message[],
  running: boolean,
): TranscriptItem[] {
  const list = [...messages];
  const results = new Map(
    list.flatMap((message) =>
      message.role === 'tool' ? [[message.toolCallId, message] as const] : [],
    ),
  );
  const lastUserIndex = list.reduce(
    (last, message, index) => (message.role === 'user' ? index : last),
    -1,
  );
  const presentation = toolPresentation(list);
  const activities = toolActivities(list, running);
  const items: TranscriptItem[] = [];
  list.forEach((message, index) => {
    if (!isChatTurn(message)) return;
    const text = textOf(message).trim();
    if (message.role === 'user') {
      if (text) items.push({ kind: 'user', id: message.id, text });
      return;
    }
    if (message.role === 'reasoning') {
      if (text) items.push({ kind: 'reasoning', id: message.id, text });
      return;
    }
    const view = presentation.get(message.id);
    const live = running && index > lastUserIndex;
    const toolCalls = (view?.message ?? message).toolCalls ?? [];
    items.push({
      kind: 'assistant',
      id: message.id,
      text,
      toolCalls: toolCalls.map((call) =>
        toolCallView(call, results.get(call.id), live),
      ),
      notes: view?.notes ?? [],
      activities: activities.get(message.id) ?? [],
    });
  });
  return items;
}

function toolCallView(
  call: NonNullable<AssistantMessage['toolCalls']>[number],
  result: Extract<Message, { role: 'tool' }> | undefined,
  live: boolean,
): ToolCallView {
  const args = parseArgs(call.function.arguments);
  return {
    id: call.id,
    name: call.function.name,
    args: args ?? {},
    status: result
      ? 'complete'
      : live
        ? args
          ? 'executing'
          : 'inProgress'
        : 'complete',
    result: result?.content,
    error: result?.error,
  };
}

function parseArgs(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    // Arguments stream in and are not valid JSON until the call is complete.
    return undefined;
  }
}

/** Whether the assistant turn has anything to show. */
export function hasContent(
  item: Extract<TranscriptItem, { kind: 'assistant' }>,
  showActivity: boolean,
): boolean {
  return (
    item.text.length > 0 ||
    item.toolCalls.length > 0 ||
    item.notes.length > 0 ||
    (showActivity && item.activities.length > 0)
  );
}
