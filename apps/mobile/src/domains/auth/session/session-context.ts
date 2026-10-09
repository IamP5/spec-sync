import { useSyncExternalStore } from 'react';

import type { SessionEvent } from '../api/events';

export interface SessionScope {
  uid: string;
  generation: number;
}

export type SessionStatus =
  | 'restoring'
  | 'signed-out'
  | 'verifying'
  | 'signed-in'
  | 'error';

export interface SessionSnapshot {
  status: SessionStatus;
  scope: SessionScope | null;
  generation: number;
}

/** Supplies a fresh Firebase ID token for the signed-in user. */
export type TokenSource = () => Promise<string>;

/**
 * The single writer of the session (a port of the web `SessionContext`).
 *
 * A session is usable only after the gateway verified the Firebase user
 * (`/auth/session`). Every change of user, sign-out or failed check bumps the
 * generation, so an async result is applied only while its scope is still
 * current (`isCurrent`).
 */
export class SessionContext {
  private state: SessionSnapshot = {
    status: 'restoring',
    scope: null,
    generation: 0,
  };
  private candidate: string | null | undefined;
  private tokenSource: TokenSource | undefined;
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Set<(event: SessionEvent) => void>();

  readonly snapshot = (): SessionSnapshot => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  onEvent(listener: (event: SessionEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** Starts checking `uid` (or records that nobody is signed in). */
  begin(uid: string | null): number {
    if (this.candidate !== uid || this.state.status === 'error') {
      this.candidate = uid;
      this.invalidate(uid ? 'verifying' : 'signed-out');
    }
    return this.state.generation;
  }

  establish(uid: string, generation: number): void {
    if (generation !== this.state.generation || this.candidate !== uid) return;
    if (this.state.scope?.uid === uid) {
      this.dispatch({ type: 'refreshed', uid, generation });
      return;
    }
    const scope = { uid, generation };
    this.set({ status: 'signed-in', scope, generation });
    this.dispatch({ type: 'established', ...scope });
  }

  invalidate(status: SessionStatus = 'signed-out'): void {
    const generation = this.state.generation + 1;
    this.set({ status, scope: null, generation });
    this.dispatch({ type: 'invalidated', generation });
  }

  reject(generation: number): void {
    if (generation === this.state.generation) this.invalidate('error');
  }

  isCurrent(scope: SessionScope): boolean {
    return (
      this.state.scope?.uid === scope.uid &&
      this.state.scope?.generation === scope.generation
    );
  }

  /** Called once by the auth client, which owns the Firebase SDK. */
  useTokenSource(source: TokenSource): void {
    this.tokenSource = source;
  }

  /** A fresh ID token for the current scope; fails when signed out. */
  async idToken(): Promise<string> {
    const scope = this.state.scope;
    if (!scope || !this.tokenSource) throw new Error('Sign in to continue.');
    const token = await this.tokenSource();
    if (!this.isCurrent(scope)) throw new Error('Session changed.');
    return token;
  }

  private set(state: SessionSnapshot): void {
    this.state = state;
    for (const listener of [...this.listeners]) listener();
  }

  private dispatch(event: SessionEvent): void {
    for (const listener of [...this.eventListeners]) listener(event);
  }
}

export const sessionContext = new SessionContext();

/** What other domains may do with the session: read it, never write it. */
export const session = {
  snapshot: sessionContext.snapshot,
  isCurrent: (scope: SessionScope) => sessionContext.isCurrent(scope),
  idToken: () => sessionContext.idToken(),
} as const;

/** The current session snapshot; re-renders on every change. */
export function useSession(): SessionSnapshot {
  return useSyncExternalStore(
    sessionContext.subscribe,
    sessionContext.snapshot,
    sessionContext.snapshot,
  );
}

export function onSessionEvent(
  listener: (event: SessionEvent) => void,
): () => void {
  return sessionContext.onEvent(listener);
}
