import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  LOCALES,
  resolveLocale,
  SOURCE_LOCALE,
  storedLocale,
  storeLocale,
} from './locale';

describe('locale resolution', () => {
  afterEach(() => localStorage.clear());

  it('offers the source locale and defaults to Brazilian Portuguese', () => {
    expect(LOCALES.map((locale) => locale.id)).toContain(SOURCE_LOCALE);
    expect(DEFAULT_LOCALE).toBe('pt-BR');
  });

  it('prefers the stored choice over what the browser asks for', () => {
    expect(resolveLocale('en-US', ['pt-BR'])).toBe('en-US');
    // Junk in storage is not a language.
    expect(resolveLocale('kl-KL', ['en-US'])).toBe('en-US');
  });

  it('matches the browser languages by tag and then by language', () => {
    expect(resolveLocale(null, ['es-419'])).toBe('es-419');
    // A Spanish-speaking region we do not ship arrives at the regional tag.
    expect(resolveLocale(null, ['es-AR', 'en-US'])).toBe('es-419');
    // As does European Portuguese, which is closer than English.
    expect(resolveLocale(null, ['pt-PT'])).toBe('pt-BR');
    expect(resolveLocale(null, ['EN-us'])).toBe('en-US');
  });

  it('falls back to the default when nothing matches', () => {
    expect(resolveLocale(null, ['fr-CA', 'de'])).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
  });

  it('persists the choice unscoped, because main.ts reads it before a session', () => {
    expect(storeLocale('es-419')).toBe(true);
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es-419');
    expect(storedLocale()).toBe('es-419');
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-PT');
    expect(storedLocale()).toBeNull();
  });
});
