// Verifies the runtime translation files against the extracted source messages.
//
// The app ships one build and loads `src/i18n/messages.<locale>.json` before
// bootstrap (`src/main.ts`), so a missing id renders the English source and an
// orphaned one is dead weight. Message ids are generated from the source text:
// editing an English string changes its id, which this check reports as one
// missing and one orphaned id — the translation has to be rewritten with it.
//
// Paths resolve against this file, so the working directory does not matter:
//   node apps/web/scripts/check-i18n.mjs            compares the committed extraction
//   node apps/web/scripts/check-i18n.mjs --extract  also proves extraction is current
//     (needs `nx run web:extract-i18n-check` first, which writes the fresh file)
import { readFileSync } from 'node:fs';
import { argv, exit } from 'node:process';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_FILE = `${app}src/i18n/messages.json`;
const FRESH_FILE = `${app}../../dist/i18n-check/messages.json`;
const LOCALE_FILE = `${app}src/app/domains/user/util/locale.ts`;

const problems = [];
const report = (message) => problems.push(message);

/** The locales the app offers, minus the source locale, read off the catalogue. */
function translatedLocales() {
  const source = readFileSync(LOCALE_FILE, 'utf8');
  const ids = [...source.matchAll(/id: '([\w-]+)'/g)].map((match) => match[1]);
  const sourceLocale = /SOURCE_LOCALE: LocaleId = '([\w-]+)'/.exec(source)?.[1];
  if (!ids.length || !sourceLocale) {
    report(`${LOCALE_FILE}: could not read the locale catalogue.`);
    return [];
  }
  return ids.filter((id) => id !== sourceLocale);
}

function read(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    report(`${path}: ${error.message}`);
    return undefined;
  }
}

/** `{$NAME}` placeholders and ICU variables, which a translation must preserve. */
function markers(message) {
  return [
    ...(message.match(/\{\$\w+\}/g) ?? []),
    ...(message.match(/VAR_[A-Z]+/g) ?? []),
  ].sort();
}

function checkLocale(locale, source) {
  const path = `${app}src/i18n/messages.${locale}.json`;
  const file = read(path);
  if (!file) return;
  if (file.locale !== locale)
    report(`${path}: declares locale "${file.locale}".`);
  const translations = file.translations ?? {};
  const missing = Object.keys(source).filter((id) => !translations[id]);
  const orphaned = Object.keys(translations).filter((id) => !source[id]);
  if (missing.length)
    report(
      `${path}: ${missing.length} untranslated message(s), e.g. ${missing
        .slice(0, 3)
        .map((id) => `${id} ${JSON.stringify(source[id])}`)
        .join(', ')}`,
    );
  if (orphaned.length)
    report(
      `${path}: ${orphaned.length} translation(s) no longer in the source, e.g. ${orphaned.slice(0, 3).join(', ')}`,
    );
  for (const [id, message] of Object.entries(translations)) {
    if (!source[id]) continue;
    const expected = markers(source[id]).join(' ');
    const actual = markers(message).join(' ');
    if (expected !== actual)
      report(
        `${path}: message ${id} carries "${actual}" instead of "${expected}".`,
      );
  }
}

const source = read(SOURCE_FILE)?.translations;
if (source) {
  for (const locale of translatedLocales()) checkLocale(locale, source);
  if (argv.includes('--extract')) {
    const fresh = read(FRESH_FILE)?.translations;
    if (fresh) {
      const added = Object.keys(fresh).filter((id) => !source[id]);
      const removed = Object.keys(source).filter((id) => !fresh[id]);
      if (added.length || removed.length)
        report(
          `${SOURCE_FILE} is stale: ${added.length} new and ${removed.length} removed message(s). Run \`nx run web:extract-i18n\` and translate the new ids.`,
        );
    }
  }
}

if (problems.length) {
  console.error(`i18n check failed:\n- ${problems.join('\n- ')}`);
  exit(1);
}
console.log('i18n check passed.');
