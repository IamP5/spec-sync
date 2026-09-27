# ADR-0005: English only for now

- Status: accepted
- Date: 2026-09-27

## Context

The web app ships in `en-US`, `pt-BR` and `es-419` (web ADR-0008). The mobile
app is at its first slice.

## Decision

- The mobile app ships in English only. User-visible text is written in
  English, directly in the components.
- The chat forwards `locale: 'en-US'`.

## Consequences

- There is no extraction or translation check yet.
- **Adding locales later** means choosing a library (ICU messages, extraction
  and a completeness check like web's `check-i18n`), marking every string,
  and forwarding the active locale instead of the constant in
  `domains/chat/data/chat-agent.ts`.
