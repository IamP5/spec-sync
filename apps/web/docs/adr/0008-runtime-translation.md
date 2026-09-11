# ADR-0008: Runtime translation with one build

Status: Accepted

## Context

The app mixed English and Brazilian Portuguese in its templates and formatted
Brazilian prices with a hardcoded `pt-BR`. It must ship in Brazilian
Portuguese, US English and Latin American Spanish, with the reader choosing
the language in Settings.

Angular offers two delivery models for `@angular/localize`. Compile-time
localization (`--localize`) emits one bundle per locale, which multiplies the
Docker image, the nginx configuration and the Cloud Run deployment by three and
requires a redeploy to add a language. Runtime translation keeps one bundle and
calls `loadTranslations()` before bootstrap.

## Decision

Mark messages the ordinary Angular way (`i18n` attributes, `i18n-{attribute}`,
ICU expressions, `$localize` tagged templates in TypeScript) and translate them
at runtime.

`en-US` is the **source locale**: every template and every `$localize` template
literal is written in English and has no translation file. `pt-BR` is the
**default runtime locale** — what a browser gets when it has no stored
preference and no matching browser language. `es-419` is the third locale. The
catalogue lives in `domains/user/util/locale.ts`; language is a user preference,
so it belongs to the `user` domain like the theme.

`src/main.ts` resolves the locale (stored preference, then `navigator.languages`
by exact tag and then by language subtag, then the default), loads
`src/i18n/messages.<locale>.json` as a lazy chunk, calls `loadTranslations()`
and only then imports the application and provides `LOCALE_ID`. **Nothing
imported by `main.ts` above that line may use `$localize`**: a message
evaluated before `loadTranslations()` keeps its English source text forever.
The locale is also stamped on `<html lang>` by the inline head script, before
the bundle loads.

Translation files are extracted with `nx run web:extract-i18n` (JSON format,
which is exactly the shape `loadTranslations()` takes) into
`src/i18n/messages.json`, the committed source catalogue. Message ids stay
**auto-generated**: editing an English string changes its id, so the stale
translation is reported as missing rather than silently shown.

`LOCALE_ID` — not a hardcoded tag — drives every `Intl` formatter, including
Brazilian prices, which stay in BRL while their separators follow the reader's
locale.

The agent answers in the reader's language: the browser sends the locale as an
AG-UI forwarded property with every run, `apps/ai` stores it in the request
context and the agent's instructions name the language
(`apps/ai/src/mastra/language.ts`).

## Consequences

One Docker image, one nginx configuration and one Cloud Run service serve every
language; adding a locale is a JSON file plus an entry in the catalogue, with
no infrastructure change. Translations are fetched as hashed chunks, so a reader
downloads only their own language, and `en-US` downloads none.

Changing the language reloads the page: `LOCALE_ID` and the loaded messages are
fixed for the life of the document. The language preference is therefore stored
under its own unscoped key, because `main.ts` reads it before a session exists.

`nx run web:check-i18n` (a fast check in `apps/web/checks.mjs`) fails when a
locale file misses an extracted message, keeps a message the source no longer
has, or loses a placeholder; `npm run verify` additionally re-extracts the
messages and fails when the committed catalogue is stale.

Strings that are part of a contract with the agent rather than text the user
reads — the prompts sent straight through by
`chat/feature-chat/tool-adapters/vehicle-prompts.ts`, tool names, attribute
codes, status codes — stay in the source language. Tool status _codes_ are kept
separate from their labels for the same reason, so translation cannot break a
template comparison.
