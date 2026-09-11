import { z } from 'zod';

import { cloudRunHeaders } from '../catalog/cloud-run-auth';
import {
  researchCreateSchema,
  researchListItemSchema,
  researchSnapshotSchema,
} from './contracts';

export const RESEARCH_SERVICE_KEY_ENV = 'SPECSYNC_RESEARCH_SERVICE_KEY';
export function researchServiceKey(): string | undefined {
  const key = process.env[RESEARCH_SERVICE_KEY_ENV];
  return key && key.length >= 32 ? key : undefined;
}

export class ResearchServiceError extends Error {
  constructor(readonly status: number) {
    super(
      status === 404
        ? 'Research request not found'
        : 'Research service unavailable',
    );
    this.name = 'ResearchServiceError';
  }
}

/** Every caller derives uid from a verified identity, never from a tool or browser input. */
export async function researchRequest<S extends z.ZodTypeAny>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body: unknown,
  schema: S,
  signal?: AbortSignal,
): Promise<z.output<S>> {
  const key = researchServiceKey();
  if (!key) throw new ResearchServiceError(503);
  const origin = process.env['SPECSYNC_API_URL'] ?? 'http://127.0.0.1:8080';
  try {
    const deadline = AbortSignal.any([
      ...(signal ? [signal] : []),
      AbortSignal.timeout(15_000),
    ]);
    deadline.throwIfAborted();
    const workloadHeaders = await untilAbort(cloudRunHeaders(origin), deadline);
    const response = await fetch(
      new URL(`/api/internal/research${path}`, origin),
      {
        method,
        redirect: 'error',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${key}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...workloadHeaders,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: deadline,
      },
    );
    if (!response.ok) throw new ResearchServiceError(response.status);
    return schema.parse(await response.json());
  } catch (error) {
    if (error instanceof ResearchServiceError) throw error;
    throw new ResearchServiceError(503);
  }
}

const requestsPath = (uid: string) =>
  `/users/${encodeURIComponent(uid)}/requests`;
export function createResearch(
  uid: string,
  body: z.infer<typeof researchCreateSchema>,
  signal?: AbortSignal,
) {
  return researchRequest(
    'POST',
    requestsPath(uid),
    researchCreateSchema.parse(body),
    researchSnapshotSchema,
    signal,
  );
}
export function listResearch(uid: string, signal?: AbortSignal) {
  return researchRequest(
    'GET',
    requestsPath(uid),
    undefined,
    z.object({ requests: z.array(researchListItemSchema).max(100) }),
    signal,
  );
}
export function readResearch(uid: string, id: string, signal?: AbortSignal) {
  return researchRequest(
    'GET',
    `${requestsPath(uid)}/${z.string().uuid().parse(id)}`,
    undefined,
    researchSnapshotSchema,
    signal,
  );
}
export function cancelResearch(uid: string, id: string, signal?: AbortSignal) {
  return researchRequest(
    'DELETE',
    `${requestsPath(uid)}/${z.string().uuid().parse(id)}`,
    undefined,
    researchSnapshotSchema,
    signal,
  );
}
export function replayResearch(
  uid: string,
  id: string,
  newId: string,
  signal?: AbortSignal,
) {
  return researchRequest(
    'POST',
    `${requestsPath(uid)}/${z.string().uuid().parse(id)}/replay`,
    { id: z.string().uuid().parse(newId) },
    researchSnapshotSchema,
    signal,
  );
}

/** A stalled workload identity lookup must not outlive a lease heartbeat. */
export function untilAbort<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    void operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

const contactSchema = z
  .string()
  .max(500)
  .url()
  .refine((value) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return false;
    }
    return (
      url.protocol === 'https:' &&
      url.hostname.includes('.') &&
      !url.username &&
      !url.password
    );
  });
const personSchema = z.object({
  name: z.string().trim().min(1).max(80),
  contactUrl: contactSchema,
  isYou: z.boolean(),
});
export const researchInterestInputSchema = z.discriminatedUnion('visible', [
  z.object({ visible: z.literal(false) }),
  z.object({
    visible: z.literal(true),
    name: z.string().trim().min(1).max(80),
    contactUrl: contactSchema,
  }),
]);
const researchInterestsSchema = z.object({
  people: z.array(personSchema).max(100),
  mine: personSchema.nullable(),
  hasMore: z.boolean(),
});
export function listResearchInterests(
  uid: string,
  id: string,
  signal?: AbortSignal,
) {
  return researchRequest(
    'GET',
    `${requestsPath(uid)}/${z.string().uuid().parse(id)}/interests`,
    undefined,
    researchInterestsSchema,
    signal,
  );
}
export function saveResearchInterest(
  uid: string,
  id: string,
  body: z.infer<typeof researchInterestInputSchema>,
  signal?: AbortSignal,
) {
  return researchRequest(
    'POST',
    `${requestsPath(uid)}/${z.string().uuid().parse(id)}/interests`,
    researchInterestInputSchema.parse(body),
    researchInterestsSchema,
    signal,
  );
}
