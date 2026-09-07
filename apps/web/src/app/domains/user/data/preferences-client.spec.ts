import { TestBed } from '@angular/core/testing';

import { USER_STORAGE_SCOPE } from '../util/storage-scope';
import { DEFAULT_PREFERENCES } from './preferences';
import { PreferencesClient } from './preferences-client';

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
    const client = TestBed.inject(PreferencesClient);
    expect(client.load()).toEqual(DEFAULT_PREFERENCES);
    expect(
      client.save({
        ...DEFAULT_PREFERENCES,
        displayName: 'Alice',
        model: 'model-a',
      }),
    ).toBe(true);
    uid = 'bob';
    expect(client.load()).toEqual(DEFAULT_PREFERENCES);
    uid = 'alice';
    expect(client.load().displayName).toBe('Alice');
    expect(client.load().model).toBe('model-a');
  });
  it('restores defaults for corrupt stored data', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: USER_STORAGE_SCOPE, useValue: () => 'alice' }],
    });
    localStorage.setItem('specsync.chat.preferences.v1.alice', '{broken');
    expect(TestBed.inject(PreferencesClient).load()).toEqual(
      DEFAULT_PREFERENCES,
    );
  });
});
