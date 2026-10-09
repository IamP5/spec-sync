import type { SessionEvent } from '../api/events';
import { SessionContext } from './session-context';

describe('SessionContext', () => {
  function context() {
    const session = new SessionContext();
    const events: SessionEvent[] = [];
    session.onEvent((event) => events.push(event));
    return { session, events };
  }

  it('is usable only after the gateway verified the user', () => {
    const { session, events } = context();
    const generation = session.begin('alice');
    expect(session.snapshot().status).toBe('verifying');
    expect(session.snapshot().scope).toBeNull();
    session.establish('alice', generation);
    expect(session.snapshot()).toMatchObject({
      status: 'signed-in',
      scope: { uid: 'alice', generation },
    });
    expect(events.at(-1)).toEqual({
      type: 'established',
      uid: 'alice',
      generation,
    });
  });

  it('ignores a verification that a newer change superseded', () => {
    const { session } = context();
    const stale = session.begin('alice');
    session.begin('bob');
    session.establish('alice', stale);
    expect(session.snapshot().status).toBe('verifying');
  });

  it('reports the same user again as a refresh', () => {
    const { session, events } = context();
    const generation = session.begin('alice');
    session.establish('alice', generation);
    session.establish('alice', generation);
    expect(events.at(-1)).toMatchObject({ type: 'refreshed', uid: 'alice' });
  });

  it('ends the scope on a failed check and on sign-out', () => {
    const { session } = context();
    const generation = session.begin('alice');
    session.establish('alice', generation);
    const scope = session.snapshot().scope;
    session.reject(generation);
    expect(session.snapshot().status).toBe('error');
    expect(scope && session.isCurrent(scope)).toBe(false);
    session.begin(null);
    expect(session.snapshot().status).toBe('signed-out');
  });

  it('hands out tokens only for the current scope', async () => {
    const { session } = context();
    await expect(session.idToken()).rejects.toThrow('Sign in to continue.');
    session.useTokenSource(async () => 'token');
    const generation = session.begin('alice');
    session.establish('alice', generation);
    await expect(session.idToken()).resolves.toBe('token');
  });
});
