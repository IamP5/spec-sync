/** Raised when the AI service answers with a non-2xx status. */
export class ChatRequestError extends Error {
  constructor(readonly status: number) {
    super(`The AI service answered with status ${status}`);
    this.name = 'ChatRequestError';
  }
}
