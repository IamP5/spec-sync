import { gatewayJson } from '../../auth/api/session';
import {
  RESEARCH_URL,
  type ResearchInterestInput,
  type ResearchPeople,
  researchPeopleSchema,
  type ResearchSnapshot,
  researchSnapshotSchema,
} from './research-contracts';

/**
 * The reader's private research requests on the AI service (a port of the
 * web `ResearchClient`). Every call goes through the authenticated gateway,
 * so it is aborted when the session ends.
 */
function researchPath(id: string): string {
  return `${RESEARCH_URL}/${encodeURIComponent(id)}`;
}

export function getResearch(
  id: string,
  signal?: AbortSignal,
): Promise<ResearchSnapshot> {
  return gatewayJson(
    researchPath(id),
    (value) => researchSnapshotSchema.parse(value),
    { signal },
  );
}

/** Stops following a request; shared research may continue for others. */
export function cancelResearch(id: string): Promise<ResearchSnapshot> {
  return gatewayJson(
    researchPath(id),
    (value) => researchSnapshotSchema.parse(value),
    { method: 'DELETE' },
  );
}

/**
 * Reads the saved source again under a new request. `newRequestId` is the
 * idempotency key: an uncertain answer is retried with the same id.
 */
export function replayResearch(
  id: string,
  newRequestId: string,
): Promise<ResearchSnapshot> {
  return gatewayJson(
    `${researchPath(id)}/replay`,
    (value) => researchSnapshotSchema.parse(value),
    { method: 'POST', body: { id: newRequestId } },
  );
}

export function getResearchPeople(
  id: string,
  signal?: AbortSignal,
): Promise<ResearchPeople> {
  return gatewayJson(
    `${researchPath(id)}/interests`,
    (value) => researchPeopleSchema.parse(value),
    { signal },
  );
}

export function saveResearchInterest(
  id: string,
  input: ResearchInterestInput,
): Promise<ResearchPeople> {
  return gatewayJson(
    `${researchPath(id)}/interests`,
    (value) => researchPeopleSchema.parse(value),
    { method: 'POST', body: input },
  );
}
