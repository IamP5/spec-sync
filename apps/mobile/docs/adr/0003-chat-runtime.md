# ADR-0003: CopilotKit headless client on the existing Mastra runtime

- Status: accepted
- Date: 2026-09-27

## Context

CopilotKit's React Native guide (https://docs.copilotkit.ai/react-native) and
its onboarding flow start a separate Node runtime with a `BuiltInAgent`
calling OpenAI.

SpecSync already runs the chat agent in `apps/ai`: Mastra with the CopilotKit
runtime on `/copilotkit`, agent id `chat`, behind the gateway at
`/ai/copilotkit`. Two of that app's red lines apply:

- no second HTTP server
- OpenRouter/Vertex through Application Default Credentials only, never API
  keys

The web client uses `@copilotkit/core` 1.70.1, `@ag-ui/client` 0.0.59 and
`runtimeTransport: 'single'`, and forwards `locale` (and optionally `mode`)
on every run.

## Decision

- **No second runtime.** The mobile app uses `@copilotkit/react-native/headless`
  (provider and hooks only), pinned to **1.70.1**. That version depends on
  exactly the `@copilotkit/core` and `@ag-ui/client` versions the web client
  and the runtime use. There is no `BuiltInAgent`, no `server.ts`, and the
  onboarding CLI is not used.
- **Provider:** `ChatRuntimeProvider` (`domains/chat/transport`) renders
  `CopilotKitProvider` with these settings:
  - `runtimeUrl = <gateway>/ai/copilotkit`
  - `useSingleEndpoint`
  - `credentials: 'omit'`
- **Entry point:** `index.js` loads `react-native-get-random-values`, then
  `@copilotkit/react-native/polyfills`, then `expo-router/entry`. The order
  matters: the first crypto polyfill wins.
- **Metro:** Metro resolves `jose` to its browser build, because CopilotKit's
  telemetry pulls it in and Hermes cannot bundle the `node:` imports.
- **Store:** `ChatConversationStore` is the only caller of `useAgent`,
  `useCopilotKit` and `runAgent`. It forwards `locale: 'en-US'`.
- **Contracts:** tool results render through registered components under the
  root ADR-0001 contracts. Until the first one is ported, the transcript shows
  user and assistant text only.

## Consequences

- **Auth is still missing.** The gateway requires a Firebase ID token, so
  chat runs return 401 until the `auth` domain supplies the `Authorization`
  header through the provider's `headers` function. That is the next slice.
- **Upgrades move together.** CopilotKit upgrades must move web, ai and mobile
  together, and `@copilotkit/react-native` must stay on the runtime's version
  line.
- **No thread switching yet.** `useAgent` on React Native does not yet take a
  `threadId`, so the mobile app cannot switch threads the way web does.
  Thread lists still come from `/ai/chat/threads` over HTTP.
