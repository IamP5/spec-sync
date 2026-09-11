import { createHash } from 'node:crypto';

import type { Message } from '@ag-ui/core';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { Memory } from '@mastra/memory';
import { z } from 'zod';

import { readResearch } from '../research/client';
import { summarizeResearch } from '../research/contracts';
import { isCoherentCompetitiveWorkspace } from '../workspace/competitive-compiler';
import { competitiveWorkspaceOutputSchema } from '../workspace/competitive-contracts';
import { toAGUIMessages } from './messages';
import {
  RESEARCH_COMPLETION_PART,
  researchCompletionOf,
  researchCompletionSchema,
} from './research-completion';

const researchTools = new Set([
  'researchVehicleSpecifications',
  'getVehicleResearch',
  'replayVehicleResearch',
  'reviewVehicleResearch',
]);
const referenceSchema = z.object({ id: z.string().uuid() });

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
        part.toolInvocation.state !== 'result'
      )
        continue;
      const name = part.toolInvocation.toolName;
      if (!researchTools.has(name) && name !== 'renderCompetitiveWorkspace')
        continue;
      try {
        const value: unknown =
          typeof part.toolInvocation.result === 'string'
            ? JSON.parse(part.toolInvocation.result)
            : part.toolInvocation.result;
        if (name === 'renderCompetitiveWorkspace') {
          const workspace = competitiveWorkspaceOutputSchema.safeParse(value);
          if (
            workspace.success &&
            isCoherentCompetitiveWorkspace(workspace.data)
          ) {
            for (const panel of workspace.data.snapshot.plan.panels) {
              if (panel.type === 'research') references.add(panel.requestId);
            }
          }
        } else {
          const reference = referenceSchema.safeParse(value);
          if (reference.success) references.add(reference.data.id);
        }
      } catch {
        /* An incomplete historical tool result has no research subscription. */
      }
    }
  }
  const updates = messages.filter((message) =>
    message.id.startsWith('research-ready-'),
  );
  const delivered = new Set(
    updates.flatMap((message) => {
      const completion = researchCompletionOf(message);
      if (completion) return [completion.requestId];
      // Historical notifications retain their recorded tool invocation.
      return (message.content.parts ?? []).flatMap((part) => {
        if (part.type !== 'tool-invocation') return [];
        const reference = referenceSchema.safeParse(part.toolInvocation.args);
        return reference.success ? [reference.data.id] : [];
      });
    }),
  );
  for (const requestId of references) {
    if (delivered.has(requestId)) continue;
    try {
      const research = await readResearch(uid, requestId, signal);
      if (
        research.requestStatus !== 'ACTIVE' ||
        (research.status !== 'REVIEW' && research.status !== 'PUBLISHED')
      )
        continue;
      const id = `research-ready-${createHash('sha256').update(`${threadId}:${research.workId}`).digest('hex')}`;
      if (ids.has(id)) continue;
      const summary = summarizeResearch(research);
      const counts = summary.configurations.reduce(
        (total, item) => total + item.claimCount,
        0,
      );
      const vehicle = `${summary.request.brand} ${summary.request.model} ${summary.request.modelYear}`;
      const completion = researchCompletionSchema.parse({
        version: 1,
        requestId,
        workId: research.workId,
        status: research.status,
        vehicle: {
          brand: research.request.brand,
          model: research.request.model,
          modelYear: research.request.modelYear,
          market: research.request.market,
        },
        counts: {
          configurations: summary.configurations.length,
          claims: counts,
          warnings: summary.warningCount,
        },
        updatedAt: research.updatedAt,
      });
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
              type: RESEARCH_COMPLETION_PART,
              data: completion,
            },
          ],
        },
      };
      signal?.throwIfAborted();
      await memory.saveMessages({ messages: [message] });
      ids.add(id);
      delivered.add(requestId);
      updates.push(message);
    } catch (error) {
      // Missing/cancelled subscriptions must not block other research in this thread.
      if (signal?.aborted) throw error;
    }
  }
  return toAGUIMessages(updates);
}
