import { inject, InjectionToken } from '@angular/core';

import { SessionContext } from '../../session/session-context';

export type {
  SessionScope,
  SessionSnapshot,
} from '../../session/session-context';
export type SessionReader = Pick<
  SessionContext,
  | 'snapshot'
  | 'scope'
  | 'authenticated'
  | 'changes$'
  | 'invalidated$'
  | 'isCurrent'
>;
export const SESSION = new InjectionToken<SessionReader>('session', {
  factory: () => inject(SessionContext),
});
