import type { AssistantMessage, Message } from '@ag-ui/client';
import { z } from 'zod';

import { parseResult } from '../util/parse-result';
import { isBackgroundTool } from './tool-visibility';

export interface ToolPresentation {
  message: AssistantMessage;
  notes: {
    id: string;
    text: string;
    sources?: { url: string; title: string }[];
    warnings?: string[];
  }[];
}

const problemSchema = z.object({ status: z.enum(['ERROR', 'UNAVAILABLE']) });

/** Apply declared visibility and exact invocation deduplication only. */
export function toolPresentation(
  messages: Message[],
): Map<string, ToolPresentation> {
  const results = new Map(
    messages.flatMap((message) =>
      message.role === 'tool' ? [[message.toolCallId, message] as const] : [],
    ),
  );
  const displayed = new Set<string>();
  const views = new Map<string, ToolPresentation>();
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const toolCalls = (message.toolCalls ?? []).filter((call) => {
      if (displayed.has(call.id)) return false;
      displayed.add(call.id);
      if (!isBackgroundTool(call.function.name)) return true;
      const result = results.get(call.id);
      return !!result?.error || !!parseResult(result?.content, problemSchema);
    });
    views.set(message.id, { message: { ...message, toolCalls }, notes: [] });
  }
  return views;
}
