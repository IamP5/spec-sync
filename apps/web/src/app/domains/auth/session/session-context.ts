import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Dispatcher } from '@ngrx/signals/events';
import { BehaviorSubject, Subject } from 'rxjs';

import { sessionEvents } from '../api/events';

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

/** Credential-free current snapshot also initializes consumers created after an event. */
@Injectable({ providedIn: 'root' })
export class SessionContext {
  private readonly dispatcher = inject(Dispatcher);
  private readonly state = new BehaviorSubject<SessionSnapshot>({
    status: 'restoring',
    scope: null,
    generation: 0,
  });
  private readonly invalidation = new Subject<void>();
  readonly invalidated$ = this.invalidation.asObservable();
  readonly changes$ = this.state.asObservable();
  readonly snapshot = toSignal(this.changes$, { requireSync: true });
  readonly scope = computed(() => this.snapshot().scope);
  readonly authenticated = computed(() => this.scope() !== null);
  private candidate: string | null | undefined;

  begin(uid: string | null): number {
    if (this.candidate !== uid || this.snapshot().status === 'error') {
      this.candidate = uid;
      this.invalidate(uid ? 'verifying' : 'signed-out');
    }
    return this.snapshot().generation;
  }
  establish(uid: string, generation: number): void {
    if (generation !== this.snapshot().generation || this.candidate !== uid)
      return;
    if (this.scope()?.uid === uid) {
      this.dispatcher.dispatch(sessionEvents.refreshed({ uid, generation }));
      return;
    }
    const scope = { uid, generation };
    this.state.next({ status: 'signed-in', scope, generation });
    this.dispatcher.dispatch(sessionEvents.established(scope));
  }
  invalidate(status: SessionStatus = 'signed-out'): void {
    const generation = this.snapshot().generation + 1;
    this.state.next({ status, scope: null, generation });
    this.invalidation.next();
    this.dispatcher.dispatch(sessionEvents.invalidated({ generation }));
  }
  reject(generation: number): void {
    if (generation === this.snapshot().generation) this.invalidate('error');
  }
  isCurrent(scope: SessionScope): boolean {
    return (
      this.scope()?.uid === scope.uid &&
      this.scope()?.generation === scope.generation
    );
  }
}
