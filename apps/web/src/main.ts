// Date, number and currency data for the languages we ship. English is built
// into Angular; these two files only register data on `globalThis.ng` and cost
// about a kilobyte each compressed, so they are imported eagerly rather than
// split into a chunk the first render would have to wait for.
import '@angular/common/locales/global/pt';
import '@angular/common/locales/global/es-419';

import { LOCALE_ID } from '@angular/core';
import { loadTranslations } from '@angular/localize';
import { bootstrapApplication } from '@angular/platform-browser';

import { resolveWebConfig, WEB_CONFIG } from './app/domains/shared/util-config';
import {
  type LocaleId,
  resolveLocale,
  SOURCE_LOCALE,
  STARTUP_ERROR,
  storedLocale,
} from './app/domains/user/api/bootstrap';

const locale = resolveLocale(storedLocale(), navigator.languages);

// Runtime configuration allows one immutable image to serve every environment.
async function bootstrap() {
  document.documentElement.lang = locale;

  // The translations have to be in place before the first template evaluates
  // its `$localize` messages, so the application is imported only afterwards.
  // Nothing above this line may reach application code.
  const [config] = await Promise.all([webConfiguration(), translate(locale)]);
  const [{ App }, { appConfig }] = await Promise.all([
    import('./app/app'),
    import('./app/app.config'),
  ]);

  await bootstrapApplication(App, {
    providers: [
      ...appConfig.providers,
      { provide: WEB_CONFIG, useValue: config },
      { provide: LOCALE_ID, useValue: locale },
    ],
  });
}

async function webConfiguration() {
  const response = await fetch('/app-config.json', {
    cache: 'no-store',
    credentials: 'omit',
  });
  if (!response.ok)
    throw new Error('Application configuration is unavailable.');
  return resolveWebConfig(await response.json(), location.origin);
}

/**
 * Loads the translated messages for `locale`. Each language is a lazy chunk,
 * so a session downloads only the one it runs in. The source locale is the
 * language the templates are written in and has no file.
 */
async function translate(target: LocaleId): Promise<void> {
  if (target === SOURCE_LOCALE) {
    return;
  }
  const messages =
    target === 'pt-BR'
      ? await import('./i18n/messages.pt-BR.json')
      : await import('./i18n/messages.es-419.json');
  loadTranslations(messages.default.translations);
}

bootstrap().catch(() => {
  document.body.textContent = STARTUP_ERROR[locale];
});
