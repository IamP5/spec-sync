/**
 * The languages SpecSync ships in.
 *
 * `en-US` is the *source* locale: every `i18n` message in a template and
 * every `$localize` string in TypeScript is written in English, so it needs
 * no translation file. The other locales are loaded as a message map before
 * the application bootstraps (see `apps/web/src/main.ts`), which is why
 * changing the language reloads the document instead of re-rendering.
 *
 * The list is ordered by preference: a browser asking for a language without
 * a region (`pt`, or a region we do not ship, `pt-PT`) gets the first entry
 * of that language.
 */
const LOCALE_LIST = [
  { id: 'pt-BR', label: 'Português (Brasil)' },
  { id: 'en-US', label: 'English (US)' },
  { id: 'es-419', label: 'Español (Latinoamérica)' },
] as const;

/** BCP 47 tag of a language the application ships in. */
export type LocaleId = (typeof LOCALE_LIST)[number]['id'];

export interface LocaleOption {
  /** Also the `LOCALE_ID` Angular formats dates, numbers and currency with. */
  id: LocaleId;
  /** The language's own name; a language picker is never translated. */
  label: string;
}

export const LOCALES: readonly LocaleOption[] = LOCALE_LIST;

/** The language written in the templates, which needs no translation file. */
export const SOURCE_LOCALE: LocaleId = 'en-US';

/** The language a browser that asks for nothing we ship ends up in. */
export const DEFAULT_LOCALE: LocaleId = 'pt-BR';

/**
 * Where the picked language is kept. Unlike the rest of the preferences it is
 * not scoped to a user and not part of their stored blob: `main.ts` has to
 * read it before Angular, and therefore before a session, exists. The theme
 * is read that early too (see the inline script in `index.html`).
 */
export const LOCALE_STORAGE_KEY = 'specsync.locale';

/**
 * The one message that cannot go through `$localize`: it is shown when the
 * application failed to start, which may well be the translation download
 * itself. Keep an entry for every language above.
 */
export const STARTUP_ERROR: Record<LocaleId, string> = {
  'pt-BR':
    'Não foi possível iniciar o SpecSync. Atualize a página ou tente novamente mais tarde.',
  'en-US': 'SpecSync could not start. Please refresh or try again later.',
  'es-419':
    'No se pudo iniciar SpecSync. Actualiza la página o vuelve a intentarlo más tarde.',
};

export function isLocaleId(value: unknown): value is LocaleId {
  return LOCALE_LIST.some((locale) => locale.id === value);
}

/**
 * The language to run in: the stored choice, else the first language the
 * browser asks for that we ship — matching the exact tag first, then the
 * language alone, so `es-AR` and `es-MX` both arrive at `es-419` — else the
 * default.
 */
export function resolveLocale(
  stored: string | null | undefined,
  preferred: readonly string[] = [],
): LocaleId {
  if (isLocaleId(stored)) {
    return stored;
  }
  for (const tag of preferred) {
    const wanted = tag.toLowerCase();
    const exact = LOCALE_LIST.find(
      (locale) => locale.id.toLowerCase() === wanted,
    );
    if (exact) {
      return exact.id;
    }
    const language = wanted.split('-')[0];
    const sameLanguage = LOCALE_LIST.find(
      (locale) => locale.id.toLowerCase().split('-')[0] === language,
    );
    if (sameLanguage) {
      return sameLanguage.id;
    }
  }
  return DEFAULT_LOCALE;
}

/** The stored language choice, or `null` when there is none or storage is blocked. */
export function storedLocale(): LocaleId | null {
  try {
    const stored = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY);
    return isLocaleId(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Persists the language choice. Returns whether storage accepted it. */
export function storeLocale(locale: LocaleId): boolean {
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}
