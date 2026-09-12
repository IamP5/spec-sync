import { createHash } from 'node:crypto';

import type { Message } from '@ag-ui/core';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { Memory } from '@mastra/memory';
import { z } from 'zod';

import { readResearch, ResearchServiceError } from '../research/client';
import { summarizeResearch } from '../research/contracts';
import { toAGUIMessages } from './messages';

const researchTools = new Set([
  'researchVehicleSpecifications',
  'getVehicleResearch',
  'replayVehicleResearch',
  'reviewVehicleResearch',
]);
const referenceSchema = z.object({ id: z.string().uuid() });

/** Prefix of the persisted completion message; the rest is a hash of the thread and work. */
export const RESEARCH_READY_PREFIX = 'research-ready-';

/**
 * What a completion message records about the research it announces. It lives
 * in the message metadata, so the announcement is a plain assistant message:
 * the research surface the real tool call mounted owns the review, and no
 * invented tool call is replayed to the model on later runs.
 */
export const researchReadySchema = z.object({
  kind: z.literal('research-ready'),
  researchId: z.string().uuid(),
  workId: z.string().uuid(),
  status: z.enum(['REVIEW', 'PUBLISHED']),
});
export type ResearchReady = z.infer<typeof researchReadySchema>;

/** The research a completion message announced, for a current or a legacy message. */
function announcedResearchId(message: MastraDBMessage): string | undefined {
  const ready = researchReadySchema.safeParse(
    message.content.metadata?.['specsync'],
  );
  if (ready.success) return ready.data.researchId;
  // Before 2026-09-12 the announcement carried a synthetic review invocation.
  for (const part of message.content.parts ?? []) {
    if (part.type !== 'tool-invocation') continue;
    const reference = referenceSchema.safeParse(part.toolInvocation.args);
    if (reference.success) return reference.data.id;
  }
  return undefined;
}

/** What one poll of a thread's research delivers. */
export interface ResearchUpdates {
  /** Every completion message persisted for the thread, oldest first. */
  messages: Message[];
  /**
   * True while a research the thread started may still complete: it is
   * queued or processing, or its status could not be read this time. False
   * once every referenced research is announced or can never be (cancelled,
   * failed, rejected, unknown to the service), so the browser can stop
   * polling until the thread changes.
   */
  pending: boolean;
}

/** Deterministic persisted messages make retries and concurrent tabs idempotent. */
export async function researchUpdates(
  memory: Memory,
  threadId: string,
  resourceId: string,
  uid: string,
  signal?: AbortSignal,
): Promise<ResearchUpdates> {
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
    message.id.startsWith(RESEARCH_READY_PREFIX),
  );
  const delivered = new Set(
    updates.flatMap((message) => announcedResearchId(message) ?? []),
  );
  let pending = false;
  for (const requestId of references) {
    if (delivered.has(requestId)) continue;
    try {
      const research = await readResearch(uid, requestId, signal);
      if (research.requestStatus !== 'ACTIVE') continue;
      if (research.status === 'QUEUED' || research.status === 'PROCESSING') {
        pending = true;
        continue;
      }
      if (research.status !== 'REVIEW' && research.status !== 'PUBLISHED')
        continue;
      const hash = createHash('sha256')
        .update(`${threadId}:${research.workId}`)
        .digest('hex');
      const id = `${RESEARCH_READY_PREFIX}${hash}`;
      if (ids.has(id)) continue;
      const summary = summarizeResearch(research);
      const counts = summary.configurations.reduce(
        (total, item) => total + item.claimCount,
        0,
      );
      const vehicle = `${summary.request.brand} ${summary.request.model} ${summary.request.modelYear}`;
      const ready: ResearchReady = {
        kind: 'research-ready',
        researchId: requestId,
        workId: research.workId,
        status: research.status,
      };
      const message: MastraDBMessage = {
        id,
        threadId,
        resourceId,
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          metadata: { specsync: ready },
          parts: [
            {
              type: 'text',
              text: `A pesquisa de ${vehicle} foi concluída: ${summary.configurations.length} versão(ões) e ${counts} dados extraídos.${summary.warningCount ? ` Há ${summary.warningCount} aviso(s) para conferir.` : ''} ${research.status === 'PUBLISHED' ? 'A publicação no catálogo já está disponível.' : 'Os dados sem conflito já estão pré-aprovados; revise os conflitos e as evidências pendentes no cartão da pesquisa acima e publique quando quiser.'} A revisão usa esta mesma pesquisa, sem uma nova extração.`,
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
      // A subscription the service does not know never completes; any other
      // failure (research service down, memory write) is retried by a later poll.
      if (!(error instanceof ResearchServiceError && error.status === 404))
        pending = true;
    }
  }
  return { messages: toAGUIMessages(updates), pending };
}
