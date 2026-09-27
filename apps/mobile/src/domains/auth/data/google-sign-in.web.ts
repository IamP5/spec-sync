/** Asks Google for an ID token; `undefined` when the user cancelled. */
export interface GoogleIdTokenPrompt {
  ready: boolean;
  unavailable?: string;
  prompt: () => Promise<string | undefined>;
}

/**
 * In a browser Firebase runs the Google popup itself
 * (`signInWithGooglePopup`), so there is no separate token prompt.
 */
export function useGoogleIdTokenPrompt(): GoogleIdTokenPrompt {
  return { ready: true, prompt: async () => undefined };
}
