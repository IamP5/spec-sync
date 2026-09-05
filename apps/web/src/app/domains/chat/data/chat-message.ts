export type ChatRole = 'user' | 'assistant';

/** One turn of the conversation, as sent to and received from the AI service. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}
