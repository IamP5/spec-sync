import type { RequestContext } from '@mastra/core/request-context';

/**
 * Request context key under which the CopilotKit route stores the language
 * the browser is running in (see `chat-model-route.ts`).
 */
export const CHAT_LOCALE_KEY = 'chat-locale';

/**
 * The languages the web app ships, by BCP 47 tag. The value is what the agent
 * reads in its instructions, so it names the variety rather than the family:
 * a Brazilian interface must not be answered in European Portuguese. A tag
 * that is not listed is ignored, and the agent keeps replying in the language
 * of the conversation.
 */
const LANGUAGES: Record<string, string> = {
  'pt-BR': 'Brazilian Portuguese',
  'en-US': 'English (United States)',
  'es-419': 'Latin American Spanish',
};

/** The language the run's interface is in, when it is one this service knows. */
export function languageOf(
  requestContext?: Pick<RequestContext, 'get'>,
): string | undefined {
  const locale = requestContext?.get(CHAT_LOCALE_KEY);
  return typeof locale === 'string' ? LANGUAGES[locale] : undefined;
}

/**
 * The sentence that opens the agent's instructions. The browser knows which
 * language the user chose in Settings, which a guess from the prompt cannot
 * recover — a single English word must not switch a Portuguese interface.
 * Without that knowledge the agent follows the conversation itself.
 */
export function languageInstruction(
  requestContext?: Pick<RequestContext, 'get'>,
): string {
  const language = languageOf(requestContext);
  return language
    ? `Write every answer in ${language}, whatever language the user writes in; keep proper names, model names, attribute codes, IDs, quotes and units unchanged.`
    : `Reply in the user's language.`;
}
