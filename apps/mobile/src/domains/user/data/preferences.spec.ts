import {
  DEFAULT_PREFERENCES,
  initialsOf,
  parsePreferences,
} from './preferences';

describe('parsePreferences', () => {
  it('keeps valid fields and defaults the rest', () => {
    expect(
      parsePreferences(
        JSON.stringify({
          theme: 'dark',
          displayName: 'Ana',
          showActivity: false,
          mode: 'unknown',
          effort: 42,
        }),
      ),
    ).toEqual({
      theme: 'dark',
      displayName: 'Ana',
      showActivity: false,
      mode: DEFAULT_PREFERENCES.mode,
      effort: DEFAULT_PREFERENCES.effort,
    });
  });

  it('falls back to the defaults for missing or broken storage', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{not json')).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('initialsOf', () => {
  it('takes up to two initials', () => {
    expect(initialsOf('ana maria souza')).toBe('AM');
    expect(initialsOf('  ')).toBe('U');
  });
});
