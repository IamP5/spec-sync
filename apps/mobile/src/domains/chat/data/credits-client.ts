import { gatewayJson } from '../../auth/api/session';
import { CREDITS_URL, type CreditsView, parseCreditsView } from './credits';

/**
 * The user's AI credits wallet. A wallet that cannot be read counts as
 * disabled (web `CreditsClient`), so credits never block the chat.
 */
export async function fetchCredits(signal?: AbortSignal): Promise<CreditsView> {
  try {
    return await gatewayJson(CREDITS_URL, parseCreditsView, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    return { enabled: false };
  }
}
