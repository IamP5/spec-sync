import { createHash } from 'node:crypto';

import type { Message } from '@ag-ui/core';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { Memory } from '@mastra/memory';
import { z } from 'zod';

import { readResearch } from '../research/client';
import { summarizeResearch } from '../research/contracts';
import { toAGUIMessages } from './messages';

const researchTools = new Set([
  'researchVehicleSpecifications',
  'getVehicleResearch',
  'replayVehicleResearch',
  'reviewVehicleResearch',
]);
const referenceSchema = z.object({ id: z.string().uuid() });

/**
 * OpenAI rejects a tool call id over 64 characters (Chat Completions once
 * capped it at 40), and the id replays with the thread on every later run, so
 * one oversized id makes the whole conversation unanswerable. A prefix of the
 * message hash keeps the call id deterministic and well inside both limits.
 */
const REVIEW_CALL_HASH_LENGTH = 32;
function reviewCallId(hash: string): string {
  return `rr-${hash.slice(0, REVIEW_CALL_HASH_LENGTH)}`;
}

/** Deterministic persisted messages make retries and concurrent tabs idempotent. */
export async function researchUpdates(
  memory: Memory,
  threadId: string,
  resourceId: string,
  uid: string,
  signal?: AbortSignal,
): Promise<Message[]> {
  const { messages } = await memory.recall({
    threadId,
    resourceId,
    perPage: false,
  });
  const ids = new Set(messages.map((message) => message.id));
  const references = new Set<string>();
  for (const message of messages) {
    for (const part of message.content.parts ?? []) {
      if (
        part.type !== 'tool-invocation' ||
        part.toolInvocation.state !== 'result' ||
        !researchTools.has(part.toolInvocation.toolName)
      )
        continue;
      try {
        const value: unknown =
          typeof part.toolInvocation.result === 'string'
            ? JSON.parse(part.toolInvocation.result)
            : part.toolInvocation.result;
        const reference = referenceSchema.safeParse(value);
        if (reference.success) references.add(reference.data.id);
      } catch {
        /* An incomplete historical tool result has no research subscription. */
      }
    }
  }
  const updates = messages.filter((message) =>
    message.id.startsWith('research-ready-'),
  );
  const delivered = new Set(
    updates.flatMap((message) =>
      (message.content.parts ?? []).flatMap((part) => {
        if (part.type !== 'tool-invocation') return [];
        const reference = referenceSchema.safeParse(part.toolInvocation.args);
        return reference.success ? [reference.data.id] : [];
      }),
    ),
  );
  for (const requestId of references) {
    if (delivered.has(requestId)) continue;
    try {
      const research = await readResearch(uid, requestId, signal);
      if (
        research.requestStatus !== 'ACTIVE' ||
        !['REVIEW', 'PUBLISHED'].includes(research.status)
      )
        continue;
      const hash = createHash('sha256')
        .update(`${threadId}:${research.workId}`)
        .digest('hex');
      const id = `research-ready-${hash}`;
      if (ids.has(id)) continue;
      const summary = summarizeResearch(research);
      const counts = summary.configurations.reduce(
        (total, item) => total + item.claimCount,
        0,
      );
      const vehicle = `${summary.request.brand} ${summary.request.model} ${summary.request.modelYear}`;
      const message: MastraDBMessage = {
        id,
        threadId,
        resourceId,
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: `A pesquisa de ${vehicle} foi concluída: ${summary.configurations.length} versão(ões) e ${counts} dados extraídos.${summary.warningCount ? ` Há ${summary.warningCount} aviso(s) para conferir.` : ''} ${research.status === 'PUBLISHED' ? 'A publicação no catálogo já está disponível.' : 'Revise as evidências, confirme a identidade e selecione os dados para importar ao catálogo.'} A revisão usa esta mesma pesquisa, sem uma nova extração.`,
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: reviewCallId(hash),
                toolName: 'reviewVehicleResearch',
                args: { id: requestId },
                result: { ...summary, reviewReady: true },
              },
            },
          ],
        },
      };
      await memory.saveMessages({ messages: [message] });
      ids.add(id);
      updates.push(message);
    } catch (error) {
      // Missing/cancelled subscriptions must not block other research in this thread.
      if (signal?.aborted) throw error;
    }
  }
  return toAGUIMessages(updates);
}
