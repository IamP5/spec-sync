/**
 * The chat contract with `apps/ai`, shared with the web app
 * (`apps/web/src/app/domains/chat/data/chat-agent.ts` and `chat-model.ts`).
 * The names are fixed by the service; do not rename them here.
 */

/** Agent id registered by the Mastra runtime (`src/mastra/agents`). */
export const CHAT_AGENT_ID = 'chat';

/** AG-UI forwarded property that carries the interface locale. */
export const CHAT_LOCALE_PROPERTY = 'locale';

/** The app ships in English only for now (see docs/adr/0005). */
export const CHAT_LOCALE = 'en-US';

/** The CopilotKit runtime endpoint behind the gateway. */
export function chatRuntimeUrl(gatewayUrl: string): string {
  return `${gatewayUrl}/ai/copilotkit`;
}
