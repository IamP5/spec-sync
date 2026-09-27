/**
 * A tool call as a registered chat component receives it: the real
 * invocation id, name and arguments, and the tool's result once the call is
 * complete. Mirrors CopilotKit's tool-call renderer props, whose status is
 * `inProgress` while arguments stream, `executing` while the tool runs and
 * `complete` once the run no longer waits for it (with or without a result).
 */
export interface ToolCallView {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'inProgress' | 'executing' | 'complete';
  /** The tool's result as the agent stored it (usually a JSON string). */
  result?: string;
  /** Set when the tool reported a failure instead of a result. */
  error?: string;
}

/**
 * What a chat card may do with the conversation (web `ChatCardActions`):
 * put a prompt in the composer for the user to edit, or send one directly.
 */
export interface ChatCardActions {
  draft: (prompt: string) => void;
  send: (prompt: string) => void;
  /** Whether `send` would run now (signed in, idle, not blocked). */
  canSend: boolean;
}
