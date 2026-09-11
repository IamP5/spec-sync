import type { Message } from '@ag-ui/client';

import {
  competitiveRejectionSchema,
  type CompetitiveWorkspace,
  competitiveWorkspaceSchema,
  sameWorkspaceJson,
} from './competitive-workspace-contracts';

export interface CompetitiveSurfaceView {
  workspace: CompetitiveWorkspace;
  notice?: string;
  conflicted: boolean;
}

/** Memoizes only validated immutable results, never rewrites recorded messages. */
export function createCompetitiveSurfaceProjection() {
  let cache = new Map<string, CachedResult>();
  const stableSnapshots = new WeakMap<
    CompetitiveWorkspace,
    CompetitiveWorkspace
  >();
  return (messages: Message[]): ReadonlyMap<string, CompetitiveSurfaceView> => {
    const calls = new Set(
      messages.flatMap((message) =>
        message.role === 'assistant'
          ? (message.toolCalls ?? [])
              .filter(
                (call) => call.function.name === 'renderCompetitiveWorkspace',
              )
              .map((call) => call.id)
          : [],
      ),
    );
    const nextCache = new Map<string, CachedResult>();
    const outputs: CompetitiveWorkspace[] = [];
    const notices = new Map<string, string>();
    const seenCalls = new Set<string>();
    for (const message of messages) {
      if (
        message.role !== 'tool' ||
        !calls.has(message.toolCallId) ||
        seenCalls.has(message.toolCallId)
      )
        continue;
      seenCalls.add(message.toolCallId);
      const text = message.content;
      const cached = cache.get(message.toolCallId);
      const result = cached?.text === text ? cached : decodeResult(text);
      const { workspace, rejection } = result;
      if (rejection?.surfaceId)
        notices.set(rejection.surfaceId, rejection.message);
      nextCache.set(message.toolCallId, result);
      if (workspace) {
        outputs.push(workspace);
        if (workspace.status !== 'ERROR') notices.delete(workspace.surfaceId);
      }
    }
    cache = nextCache;
    const surfaces = new Map<string, CompetitiveSurfaceView>();
    for (const surfaceId of new Set(
      outputs.map((output) => output.surfaceId),
    )) {
      const candidates = outputs.filter(
        (output) => output.surfaceId === surfaceId,
      );
      const successful = candidates
        .filter((output) => output.status !== 'ERROR')
        .sort((a, b) => a.revision - b.revision);
      let workspace: CompetitiveWorkspace | undefined;
      let conflicted = false;
      for (let revision = 1; ; revision++) {
        const children = successful.filter(
          (output) => output.revision === revision,
        );
        if (!children.length) {
          conflicted = successful.some((output) => output.revision > revision);
          break;
        }
        if (children.length !== 1) {
          conflicted = true;
          break;
        }
        const received = children[0];
        const stable =
          stableSnapshots.get(received) ??
          preserveSnapshotIdentity(received, workspace);
        stableSnapshots.set(received, stable);
        workspace = stable;
      }
      // A first failed snapshot can explain the failure, but cannot accept actions.
      workspace ??= candidates.find(
        (output) => output.revision === 1 && output.status === 'ERROR',
      );
      if (!workspace) continue;
      const failedUpdate = candidates.some(
        (output) =>
          output.status === 'ERROR' &&
          output.baseRevision >= workspace.revision,
      );
      const notice = conflicted
        ? 'Conflicting or incomplete revisions were received. The last verified analysis is preserved. Start a new analysis to continue.'
        : (notices.get(surfaceId) ??
          (failedUpdate
            ? 'The update could not retrieve its data. The previous analysis is preserved; you can retry your action.'
            : undefined));
      surfaces.set(surfaceId, { workspace, notice, conflicted });
    }
    return surfaces;
  };
}
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
function parseWorkspace(value: unknown): CompetitiveWorkspace | undefined {
  const parsed = competitiveWorkspaceSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

interface CachedResult {
  text: string;
  workspace: CompetitiveWorkspace | undefined;
  rejection?: { surfaceId?: string; message: string };
}
function decodeResult(text: string): CachedResult {
  const value = parseJson(text),
    rejection = competitiveRejectionSchema.safeParse(value);
  return {
    text,
    workspace: parseWorkspace(value),
    ...(rejection.success ? { rejection: rejection.data } : {}),
  };
}

/** Reuses only equal typed values within the explicit revision chain. */
function preserveSnapshotIdentity(
  current: CompetitiveWorkspace,
  previous: CompetitiveWorkspace | undefined,
): CompetitiveWorkspace {
  if (!previous) return current;
  const snapshot = current.snapshot,
    old = previous.snapshot;
  return {
    ...current,
    snapshot: {
      ...snapshot,
      plan: {
        ...snapshot.plan,
        context: sameWorkspaceJson(snapshot.plan.context, old.plan.context)
          ? old.plan.context
          : snapshot.plan.context,
      },
      availableAttributes: sameWorkspaceJson(
        snapshot.availableAttributes,
        old.availableAttributes,
      )
        ? old.availableAttributes
        : snapshot.availableAttributes,
      panels: snapshot.panels.map((panel) => {
        const before = old.panels.find((value) => value.id === panel.id);
        return before && sameWorkspaceJson(panel, before) ? before : panel;
      }),
    },
  };
}
