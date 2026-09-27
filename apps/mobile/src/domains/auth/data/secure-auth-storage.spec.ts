import { chunksOf, secureKeyOf } from './secure-auth-storage';

jest.mock('expo-secure-store', () => ({}));

describe('secure auth storage', () => {
  it('escapes Firebase keys to the characters SecureStore accepts', () => {
    expect(secureKeyOf('firebase:authUser:KEY:[DEFAULT]')).toBe(
      'specsync.auth.firebase_authUser_KEY__DEFAULT_',
    );
  });

  it('splits long values and keeps short ones whole', () => {
    expect(chunksOf('abcde', 2)).toEqual(['ab', 'cd', 'e']);
    expect(chunksOf('')).toEqual(['']);
  });
});
