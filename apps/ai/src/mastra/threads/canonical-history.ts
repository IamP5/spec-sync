import type {
  MastraDBMessage,
  MastraMessagePart,
} from '@mastra/core/agent/message-list';
import type { Processor } from '@mastra/core/processors';

type InvocationPart = Extract<MastraMessagePart, { type: 'tool-invocation' }>;
interface Occurrence {
  row: number;
  part: number;
  value: InvocationPart;
}

/** Remove equivalent replay copies, preferring the original structured server result. */
export function canonicalHistory(stored: MastraDBMessage[]): MastraDBMessage[] {
  const occurrences = new Map<string, Occurrence[]>();
  stored.forEach((message, row) =>
    (message.content.parts ?? []).forEach((value, part) => {
      if (value.type !== 'tool-invocation') return;
      const id = value.toolInvocation.toolCallId;
      occurrences.set(id, [
        ...(occurrences.get(id) ?? []),
        { row, part, value },
      ]);
    }),
  );
  const removed = new Set<string>();
  for (const calls of occurrences.values()) {
    if (calls.length < 2) continue;
    const completed = calls.filter(
      ({ value }) => value.toolInvocation.state === 'result',
    );
    const candidates = completed.length ? completed : calls;
    const original =
      candidates.find(({ value }) => {
        const call = value.toolInvocation;
        return call.state === 'result' && typeof call.result !== 'string';
      }) ?? candidates[0];
    if (!original) continue;
    const expected = original.value.toolInvocation;
    for (const occurrence of calls) {
      const call = occurrence.value.toolInvocation;
      if (
        call.toolName !== expected.toolName ||
        stable(call.args) !== stable(expected.args) ||
        (call.state === 'result' &&
          expected.state === 'result' &&
          stable(decoded(call.result)) !== stable(decoded(expected.result)))
      ) {
        throw new Error(`Conflicting stored tool call: ${call.toolCallId}`);
      }
      if (occurrence !== original)
        removed.add(`${occurrence.row}:${occurrence.part}`);
    }
  }
  if (!removed.size) return stored;
  return stored.map((message, row) => {
    const parts = message.content.parts.filter(
      (_, part) => !removed.has(`${row}:${part}`),
    );
    if (parts.length === message.content.parts.length) return message;
    return { ...message, content: { ...message.content, parts } };
  });
}

function decoded(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (typeof value === 'object' && value !== null)
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

/** Runs after Mastra loads memory, so existing replay copies never reach the model. */
export const canonicalHistoryProcessor = {
  id: 'canonical-tool-history',
  processInput: ({ messages }) => canonicalHistory(messages),
} satisfies Processor;
