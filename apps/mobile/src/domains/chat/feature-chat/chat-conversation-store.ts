import type { Message } from '@ag-ui/client';
import { useAgent, useCopilotKit } from '@copilotkit/react-native/headless';
import { useEffect, useSyncExternalStore } from 'react';
import { create } from 'zustand';

import { session, useSession } from '../../auth/api/session';
import { mobileConfig } from '../../shared/util-config/mobile-config';
import {
  CHAT_AGENT_ID,
  type ChatAgentError,
  type ChatRunOptions,
  chatRuntimeUrl,
  normalizeThread,
} from '../data/chat-agent';
import { chatAgentClient } from '../data/chat-agent-client';
import { transcriptOf } from '../data/chat-message';
import { fetchResearchUpdates, findThread } from '../data/thread-client';

/** How often research started from the thread is checked for completion. */
const RESEARCH_POLL_MS = 8000;

const RESEARCH_TOOLS = new Set([
  'researchVehicleSpecifications',
  'getVehicleResearch',
  'replayVehicleResearch',
  'reviewVehicleResearch',
]);

interface ConversationState {
  error: ChatAgentError | undefined;
  /** The user stopped the last reply. */
  stopped: boolean;
  /** Id of the stored thread being read, if any. */
  loadingThreadId: string | undefined;
  /** Whether research of this thread may still announce its completion. */
  researchPending: boolean;
  /** The thread was sent to in this app session (reveals and title refresh). */
  sentHere: boolean;
}

/** State that must outlive a screen (the thread survives a remount). */
const useConversationState = create<ConversationState>(() => ({
  error: undefined,
  stopped: false,
  loadingThreadId: undefined,
  researchPending: true,
  sentHere: false,
}));

/** `uid:generation` the runtime is connected for; empty while signed out. */
let connectedScope: string | undefined;

/**
 * The handshake (runtime info) can fail on a flaky network, or when Android
 * sends it on a connection Cloud Run already closed; it is tried again after
 * these delays before the chat reports the assistant as unavailable.
 */
const HANDSHAKE_RETRY_MS = [1000, 3000, 8000];
const HANDSHAKE_ERROR_CODES = new Set([
  'runtime_info_fetch_failed',
  'agent_connect_failed',
]);
let handshakeAttempts = 0;

/** Errors that mean the runtime was never reached (web `ChatCoordinator`). */
const UNAVAILABLE_CODES = new Set([
  ...HANDSHAKE_ERROR_CODES,
  'agent_not_found',
]);

type CopilotKitClient = ReturnType<typeof useCopilotKit>['copilotkit'];

/** Puts the user's token on the runtime and runs the handshake again. */
function connectRuntime(copilotkit: CopilotKitClient, key: string): void {
  session.idToken().then(
    (token) => {
      if (connectedScope !== key) return;
      copilotkit.setHeaders({ Authorization: `Bearer ${token}` });
      const url = chatRuntimeUrl(mobileConfig.gatewayUrl);
      copilotkit.setRuntimeUrl(undefined);
      copilotkit.setRuntimeUrl(url);
    },
    () => undefined,
  );
}

function set(state: Partial<ConversationState>): void {
  useConversationState.setState(state);
}

function subscribeClient(listener: () => void) {
  return chatAgentClient.subscribe(listener);
}

/**
 * The conversation with the chat agent (web `ConversationDetailStore` +
 * `ChatConnectionCoordinator`): it connects CopilotKit to the runtime once the
 * session is verified, opens stored threads, sends, stops and regenerates, and
 * follows research completions. It is the only place that talks to CopilotKit
 * (docs/adr/0003-chat-runtime.md).
 */
export function useChatConversationStore() {
  // The AG-UI agent mutates its message list in place, so the React Compiler
  // must not memoize values derived from it.
  'use no memo';
  const { agent, isReady } = useAgent({ agentId: CHAT_AGENT_ID });
  const { copilotkit } = useCopilotKit();
  const snapshot = useSession();
  const scope = snapshot.scope;
  const state = useConversationState();
  const threadId = useSyncExternalStore(
    subscribeClient,
    () => chatAgentClient.threadId,
  );
  const placements = useSyncExternalStore(
    subscribeClient,
    () => chatAgentClient.placements,
  );

  // Connect the runtime with the user's token once the session is verified;
  // disconnect and forget the conversation when it ends.
  useEffect(() => {
    const key = scope ? `${scope.uid}:${scope.generation}` : '';
    if (connectedScope === key) return;
    connectedScope = key;
    if (!scope) {
      copilotkit.setHeaders({});
      if (agent.messages.length) chatAgentClient.reset(copilotkit, agent);
      set({ error: undefined, stopped: false, loadingThreadId: undefined });
      return;
    }
    // The handshake made without a token failed; run it again.
    handshakeAttempts = 0;
    connectRuntime(copilotkit, key);
    // Reconnect only when the verified user or session generation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope?.uid, scope?.generation, copilotkit]);

  useEffect(
    () =>
      chatAgentClient.onError(copilotkit, (error) => {
        // Signed out, the runtime refuses the handshake; that is expected.
        if (!session.snapshot().scope) return;
        const key = connectedScope;
        const delay = HANDSHAKE_RETRY_MS[handshakeAttempts];
        if (key && HANDSHAKE_ERROR_CODES.has(error.code) && delay) {
          handshakeAttempts += 1;
          setTimeout(() => {
            if (connectedScope === key) connectRuntime(copilotkit, key);
          }, delay);
          return;
        }
        set({ error, stopped: false });
      }),
    [copilotkit],
  );

  // Once connected, a failed handshake is behind us: clear what it reported.
  useEffect(() => {
    if (!isReady) return;
    handshakeAttempts = 0;
    const error = useConversationState.getState().error;
    if (error && UNAVAILABLE_CODES.has(error.code)) set({ error: undefined });
  }, [isReady]);

  const running = isReady && agent.isRunning;
  const loading = state.loadingThreadId !== undefined;
  const messages = isReady
    ? normalizeThread(agent.messages, placements)
    : ([] as Message[]);

  // Research started from this thread persists a completion message; ask for
  // it every 8 s while the chat is idle (web `ConversationDetailStore`).
  useEffect(() => {
    if (!isReady || !scope || running || loading || !state.researchPending) {
      return;
    }
    if (!hasResearchCall(agent.messages)) {
      set({ researchPending: false });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const polledThread = chatAgentClient.threadId;
    const tick = async () => {
      try {
        const updates = await fetchResearchUpdates(
          polledThread,
          controller.signal,
        );
        if (
          cancelled ||
          polledThread !== chatAgentClient.threadId ||
          agent.isRunning
        ) {
          return;
        }
        chatAgentClient.appendPersisted(agent, updates.messages);
        if (!updates.pending) set({ researchPending: false });
      } catch {
        // The next tick asks again.
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), RESEARCH_POLL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [
    isReady,
    scope,
    running,
    loading,
    state.researchPending,
    threadId,
    agent,
  ]);

  async function authenticate(): Promise<void> {
    const token = await session.idToken();
    copilotkit.setHeaders({ Authorization: `Bearer ${token}` });
  }

  function current(): boolean {
    return scope !== null && session.isCurrent(scope);
  }

  async function guarded(work: () => Promise<void>): Promise<void> {
    set({ error: undefined, stopped: false, researchPending: true });
    try {
      await work();
    } catch (cause) {
      set({
        error: {
          code: 'agent_run_failed' as ChatAgentError['code'],
          error:
            cause instanceof Error
              ? cause
              : new Error('The assistant could not answer.'),
        },
      });
    }
  }

  /** Sends a user turn and runs the agent on it. */
  async function send(text: string, options: ChatRunOptions): Promise<void> {
    const content = text.trim();
    if (!content || !isReady || agent.isRunning || !scope) return;
    chatAgentClient.append(agent, content);
    set({ sentHere: true });
    await guarded(() =>
      chatAgentClient.run(copilotkit, agent, options, authenticate, current),
    );
  }

  /** Runs the last user turn again (also the retry after a failure). */
  async function regenerate(options: ChatRunOptions): Promise<void> {
    if (!isReady || agent.isRunning || !scope) return;
    set({ sentHere: true });
    await guarded(() =>
      chatAgentClient.regenerate(
        copilotkit,
        agent,
        options,
        authenticate,
        current,
      ),
    );
  }

  /** Runs the handshake again (the retry when the assistant was unavailable). */
  function reconnect(): void {
    if (!scope || !connectedScope) return;
    handshakeAttempts = 0;
    set({ error: undefined });
    connectRuntime(copilotkit, connectedScope);
  }

  function stop(): void {
    chatAgentClient.stop(copilotkit);
    set({ stopped: true });
  }

  /** Starts an empty conversation with a new thread id. */
  function startNew(): void {
    chatAgentClient.reset(copilotkit, agent);
    set({
      error: undefined,
      stopped: false,
      loadingThreadId: undefined,
      researchPending: true,
      sentHere: false,
    });
  }

  /**
   * Opens a stored thread. Resolves false when it does not exist (anymore)
   * or does not belong to the user.
   */
  async function open(id: string): Promise<boolean> {
    if (chatAgentClient.threadId === id) return true;
    set({ loadingThreadId: id, error: undefined, stopped: false });
    try {
      const thread = await findThread(id);
      if (useConversationState.getState().loadingThreadId !== id) return true;
      if (!thread) {
        set({ loadingThreadId: undefined });
        return false;
      }
      chatAgentClient.load(copilotkit, agent, thread.id, thread.messages);
      set({
        loadingThreadId: undefined,
        researchPending: true,
        sentHere: false,
      });
      return true;
    } catch {
      if (useConversationState.getState().loadingThreadId === id) {
        set({ loadingThreadId: undefined });
      }
      return false;
    }
  }

  return {
    /** Signed in and connected to the runtime. */
    ready: scope !== null && isReady,
    signedIn: scope !== null,
    checkingSession:
      snapshot.status === 'restoring' || snapshot.status === 'verifying',
    threadId,
    messages,
    transcript: transcriptOf(messages, running),
    empty: messages.length === 0,
    running,
    loading,
    loadingThreadId: state.loadingThreadId,
    error: state.error,
    stopped: state.stopped,
    sentHere: state.sentHere,
    send,
    regenerate,
    reconnect,
    stop,
    startNew,
    open,
  };
}

function hasResearchCall(messages: readonly Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === 'assistant' &&
      (message.toolCalls ?? []).some((call) =>
        RESEARCH_TOOLS.has(call.function.name),
      ),
  );
}
