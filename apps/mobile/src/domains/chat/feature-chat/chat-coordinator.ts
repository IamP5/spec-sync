import { useUserPreferencesCoordinator } from '../../user/api/preferences';
import { textOf } from '../data/chat-agent';
import {
  type ChatMode,
  type ChatModeOption,
  effectiveEffort,
  effectiveMode,
  messagesCovered,
  needsCostConfirmation,
} from '../data/chat-model';
import { formatCredits, isBelowSmallestShown } from '../data/credits';
import { DEFAULT_TITLE, threadTitleOf } from '../data/thread';
import { useChatConversationStore } from './chat-conversation-store';
import { useChatModelStore } from './chat-model-store';
import { useCreditsStore } from './credits-store';
import { useThreadSearchStore } from './thread-search-store';

const UNAVAILABLE_CODES = new Set([
  'runtime_info_fetch_failed',
  'agent_connect_failed',
  'agent_not_found',
]);

/**
 * The chat workflow (web `ChatCoordinator`): the conversation with the run
 * options the user picked, the credits wallet read again after every run,
 * the thread list refreshed so a new conversation and its title appear, and
 * the sentences for failures.
 */
export function useChatCoordinator() {
  'use no memo';
  const conversation = useChatConversationStore();
  const credits = useCreditsStore();
  const models = useChatModelStore();
  const preferences = useUserPreferencesCoordinator();
  const threads = useThreadSearchStore();
  const catalog = models.catalog;
  const wallet = credits.wallet;

  const mode = effectiveMode(preferences.mode, catalog);
  const options = {
    mode,
    effort: effectiveEffort(preferences.effort, catalog),
  };

  function afterRun() {
    credits.refresh();
    threads.refresh();
  }

  async function send(text: string) {
    await conversation.send(text, options);
    afterRun();
  }

  async function regenerate() {
    await conversation.regenerate(options);
    afterRun();
  }

  async function switchToInstant() {
    preferences.update({ mode: 'velocity' });
    await conversation.regenerate({ ...options, mode: 'velocity' });
    afterRun();
  }

  const error = conversation.error;
  const creditsError = error?.credits;
  const firstUser = conversation.messages.find(
    (message) => message.role === 'user',
  );

  return {
    ...conversation,
    send,
    regenerate,
    switchToInstant,
    title: titleOf(
      threads.titleOf(conversation.threadId),
      firstUser ? textOf(firstUser) : '',
    ),
    displayName: preferences.displayName,
    showActivity: preferences.showActivity,
    setShowActivity: (showActivity: boolean) =>
      preferences.update({ showActivity }),
    modes: catalog?.modes ?? [],
    selectedMode: (mode || catalog?.defaultModeId || 'normal') as ChatMode,
    setMode: (next: ChatMode) => preferences.update({ mode: next }),
    modeCost: (option: ChatModeOption) => costOf(option),
    needsConfirmation: (option: ChatModeOption) =>
      needsCostConfirmation(option, wallet?.available),
    messagesCovered: (option: ChatModeOption) =>
      messagesCovered(wallet?.available ?? 0, option.estimatedCredits),
    wallet,
    exhausted: wallet?.exhausted ?? false,
    creditsError,
    offersInstant:
      (catalog?.modes ?? []).some((option) => option.id === 'velocity') &&
      mode !== 'velocity',
    errorMessage:
      error && !creditsError
        ? UNAVAILABLE_CODES.has(error.code)
          ? 'The assistant is unavailable. Make sure the AI service is running.'
          : 'The assistant could not answer. Please try again.'
        : undefined,
  };
}

/**
 * The thread's stored title, or one taken from its first message while the
 * AI service has not written one yet (it titles a thread after the reply).
 */
function titleOf(stored: string | undefined, firstMessage: string): string {
  if (stored && stored !== DEFAULT_TITLE) return stored;
  return firstMessage ? threadTitleOf(firstMessage) : DEFAULT_TITLE;
}

/** "≈ 0.42 credits per message", as the web mode picker words it. */
function costOf(option: ChatModeOption): string {
  if (!option.estimatedCredits) return '';
  const amount = formatCredits(option.estimatedCredits);
  return isBelowSmallestShown(option.estimatedCredits)
    ? `${amount} credits per message`
    : `≈ ${amount} credits per message`;
}
