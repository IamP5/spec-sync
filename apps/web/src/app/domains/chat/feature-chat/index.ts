export { ThreadSearch } from './thread-search/thread-search';

/** Keep the routed page lazy when the shell imports the thread sidebar. */
export const loadChatPage = () =>
  import('./chat-page/chat-page').then((module) => module.ChatPage);

export { HistorySettingsEdit } from './settings-edit/settings-edit';
