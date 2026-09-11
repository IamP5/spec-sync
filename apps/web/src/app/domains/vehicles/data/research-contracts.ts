import { z } from 'zod';

import {
  ingestionConfigurationDraftSchema,
  ingestionRequestSchema,
  ingestionStatusSchema,
} from './ingestion-contracts';

export const RESEARCH_URL = '/ai/chat/research';

/** Safe, user-owned projection of shared research; no curator-only fields. */
export const researchSnapshotSchema = z.object({
  id: z.string().uuid(),
  workId: z.string().uuid(),
  requestStatus: z.enum(['ACTIVE', 'CANCELLED']),
  disposition: z.enum(['CREATED', 'JOINED', 'REUSED']),
  request: ingestionRequestSchema,
  status: ingestionStatusSchema,
  attempts: z.number(),
  stage: z.string(),
  ontologyRevision: z.number().int().nonnegative().optional(),
  normalizationRevision: z.string().nullable().optional(),
  replayedFromWorkId: z.string().uuid().nullable().optional(),
  configurations: z.array(ingestionConfigurationDraftSchema),
  warnings: z.array(z.string()),
  error: z.string().nullable(),
  source: z
    .object({
      url: z.string().url(),
      title: z.string(),
      mimeType: z.string(),
      originalSha256: z.string(),
      textSha256: z.string(),
      parserVersion: z.string(),
    })
    .nullable(),
  configurationIds: z.record(z.string()),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type ResearchSnapshot = z.infer<typeof researchSnapshotSchema>;

export const researchSummarySchema = researchSnapshotSchema.pick({
  id: true,
  workId: true,
  requestStatus: true,
  disposition: true,
  request: true,
  status: true,
  attempts: true,
  stage: true,
  createdAt: true,
  updatedAt: true,
});
export type ResearchSummary = z.infer<typeof researchSummarySchema>;

export function parseResearchList(value: unknown): ResearchSummary[] {
  return z.object({ requests: z.array(researchSummarySchema) }).parse(value)
    .requests;
}

export function researchIsActive(
  value: ResearchSnapshot | null | undefined,
): boolean {
  return (
    value?.requestStatus === 'ACTIVE' &&
    (value.status === 'QUEUED' || value.status === 'PROCESSING')
  );
}

export const researchContactUrlSchema = z
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
export const researchPersonSchema = z.object({
  name: z.string().trim().min(1).max(80),
  contactUrl: researchContactUrlSchema,
  isYou: z.boolean(),
});
export const researchPeopleSchema = z.object({
  people: z.array(researchPersonSchema).max(100),
  mine: researchPersonSchema.nullable(),
  hasMore: z.boolean(),
});
export type ResearchPeople = z.infer<typeof researchPeopleSchema>;
export type ResearchInterestInput =
  | { visible: false }
  | { visible: true; name: string; contactUrl: string };
