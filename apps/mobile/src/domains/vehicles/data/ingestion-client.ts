import { gatewayFetch, gatewayJson } from '../../auth/api/session';
import {
  type IngestionReview,
  type IngestionRun,
  parseIngestion,
} from './ingestion-contracts';

/**
 * The research review on the AI service (the research mode of the web
 * `IngestionClient`): the run behind one research request and the
 * publication of the reviewer's selection. The reader's account authorizes
 * both; no curator key is involved.
 */
function reviewPath(researchId: string): string {
  return `/ai/chat/research/${encodeURIComponent(researchId)}/review`;
}

export function getResearchReview(
  researchId: string,
  signal?: AbortSignal,
): Promise<IngestionRun> {
  return gatewayJson(reviewPath(researchId), parseIngestion, { signal });
}

const PUBLISH_FAILED = 'Could not publish. Refresh the review and try again.';

/** Publishes the selection; a refusal carries the service's own reason. */
export async function publishResearchReview(
  researchId: string,
  review: IngestionReview,
): Promise<IngestionRun> {
  let response: Response;
  try {
    response = await gatewayFetch(`${reviewPath(researchId)}/publish`, {
      method: 'POST',
      body: { review },
    });
  } catch {
    throw new Error(PUBLISH_FAILED);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string' &&
      body.error.trim()
        ? body.error
        : PUBLISH_FAILED;
    throw new Error(message);
  }
  try {
    return parseIngestion(body);
  } catch {
    throw new Error(PUBLISH_FAILED);
  }
}
