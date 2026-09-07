import { TestBed } from '@angular/core/testing';

import { USER_STORAGE_SCOPE } from '../util/storage-scope';
import { DEFAULT_PREFERENCES } from './preferences';
import { UserPreferencesClient } from './user-preferences-client';

describe('user preference persistence', () => {
  afterEach(() => localStorage.clear());
  it('isolates each account and does not claim anonymous preferences', () => {
    let uid = 'alice';
    localStorage.setItem(
      'specsync.chat.preferences.v1',
      JSON.stringify({ displayName: 'Anonymous' }),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: USER_STORAGE_SCOPE, useValue: () => uid }],
    });
    const client = TestBed.inject(UserPreferencesClient);
    expect(client.load()).toEqual(DEFAULT_PREFERENCES);
    expect(
      client.save({
        ...DEFAULT_PREFERENCES,
        displayName: 'Alice',
        mode: 'intelligent',
        roleModels: { chat: 'anthropic/claude-sonnet-5' },
      }),
    ).toBe(true);
    uid = 'bob';
    expect(client.load()).toEqual(DEFAULT_PREFERENCES);
    uid = 'alice';
    expect(client.load().displayName).toBe('Alice');
    expect(client.load().mode).toBe('intelligent');
    expect(client.load().roleModels).toEqual({
      chat: 'anthropic/claude-sonnet-5',
    });
  });
  it('migrates the old account theme while keeping new preferences authoritative', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: USER_STORAGE_SCOPE, useValue: () => 'alice' }],
    });
    const client = TestBed.inject(UserPreferencesClient);
    localStorage.setItem(
      'specsync.user.alice.configuration',
      JSON.stringify({ theme: 'dark' }),
    );
    expect(client.load().theme).toBe('dark');
    client.save({ ...client.load(), theme: 'light' });
    expect(client.load().theme).toBe('light');
    localStorage.setItem('specsync.user.alice.configuration', '{broken');
    expect(client.load().theme).toBe('light');
  });
  it('restores defaults for corrupt stored data', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: USER_STORAGE_SCOPE, useValue: () => 'alice' }],
    });
    localStorage.setItem('specsync.chat.preferences.v1.alice', '{broken');
    expect(TestBed.inject(UserPreferencesClient).load()).toEqual(
      DEFAULT_PREFERENCES,
    );
  });

  it('migrates the model of the first release into the chat role', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: USER_STORAGE_SCOPE, useValue: () => 'alice' }],
    });
    localStorage.setItem(
      'specsync.chat.preferences.v1.alice',
      JSON.stringify({ model: 'gemini-2.5-flash', effort: 'high' }),
    );
    const client = TestBed.inject(UserPreferencesClient);
    const loaded = client.load();
    expect(loaded.roleModels).toEqual({ chat: 'gemini-2.5-flash' });
    // The mode is not guessed from it; the default mode stands.
    expect(loaded.mode).toBe(DEFAULT_PREFERENCES.mode);
    expect(loaded.effort).toBe('high');

    // Saving drops the old field for good.
    client.save(loaded);
    expect(
      localStorage.getItem('specsync.chat.preferences.v1.alice'),
    ).not.toContain('"model"');
  });

  it('ignores stored junk in the mode and the overrides', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: USER_STORAGE_SCOPE, useValue: () => 'alice' }],
    });
    localStorage.setItem(
      'specsync.chat.preferences.v1.alice',
      JSON.stringify({
        mode: 'turbo',
        roleModels: { chat: 42, nonsense: 'x', vision: '' },
      }),
    );
    const loaded = TestBed.inject(UserPreferencesClient).load();
    expect(loaded.mode).toBe(DEFAULT_PREFERENCES.mode);
    expect(loaded.roleModels).toEqual({});
  });
});
