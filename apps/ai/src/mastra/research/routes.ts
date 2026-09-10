import { timingSafeEqual } from 'node:crypto';

import { type ContextWithMastra, registerApiRoute } from '@mastra/core/server';
import { z } from 'zod';

import { requireVerifiedUser, verifiedUserOf } from '../identity';
import { validateSourceUrl } from '../ingestion/source';
import {
  cancelResearch,
  createResearch,
  listResearch,
  readResearch,
  replayResearch,
  ResearchServiceError,
  researchServiceKey,
} from './client';
import { researchCreateSchema } from './contracts';
import { researchInterestsRoutes } from './interests-route';
import { runSharedResearch } from './workflow';

export const CHAT_RESEARCH_PATH = '/chat/research';

function serviceFailure(c: ContextWithMastra, error: unknown, detail: boolean) {
  if (
    error instanceof ResearchServiceError &&
    (error.status === 404 || (detail && error.status === 422))
  )
    return c.json({ error: 'Research request not found' }, 404);
  if (error instanceof ResearchServiceError && error.status === 422)
    return c.json(
      {
        error:
          'Research request is invalid or unavailable for this configuration',
      },
      422,
    );
  if (error instanceof ResearchServiceError && error.status === 409)
    return c.json(
      { error: 'Research request conflicts with an existing request' },
      409,
    );
  return c.json({ error: 'Research service unavailable' }, 503);
}

const browserRoute = (method: 'GET' | 'POST' | 'DELETE', detail = false) =>
  registerApiRoute(`${CHAT_RESEARCH_PATH}${detail ? '/:id' : ''}`, {
    method,
    middleware: async (c, next) => {
      c.header('Cache-Control', 'no-store');
      return requireVerifiedUser(c, next);
    },
    handler: async (c) => {
      const user = await verifiedUserOf(c.req.raw.headers);
      if (!user) return c.json({ error: 'Authentication required' }, 401);
      try {
        const signal = c.req.raw.signal;
        if (detail) {
          const id = z.string().uuid().safeParse(c.req.param('id'));
          if (!id.success)
            return c.json({ error: 'Invalid research request id' }, 400);
          return c.json(
            await (method === 'DELETE' ? cancelResearch : readResearch)(
              user.uid,
              id.data,
              signal,
            ),
          );
        }
        if (method === 'GET')
          return c.json(await listResearch(user.uid, signal));
        const text = await c.req.text();
        if (text.length > 20_000)
          return c.json({ error: 'Request too large' }, 413);
        let body: z.infer<typeof researchCreateSchema>;
        try {
          body = researchCreateSchema.parse(JSON.parse(text));
          validateSourceUrl(body.request.sourceUrl);
        } catch {
          return c.json(
            {
              error:
                'Provide an approved source, vehicle and explicit Brazilian model year',
            },
            400,
          );
        }
        return c.json(await createResearch(user.uid, body, signal));
      } catch (error) {
        return serviceFailure(c, error, detail);
      }
    },
  });

export function authorizedResearchWorker(header: string | undefined): boolean {
  const key = researchServiceKey();
  if (!key || !header) return false;
  const expected = Buffer.from(`Bearer ${key}`);
  const supplied = Buffer.from(header);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

export const researchRoutes = [
  browserRoute('GET'),
  browserRoute('POST'),
  browserRoute('GET', true),
  browserRoute('DELETE', true),
  registerApiRoute(`${CHAT_RESEARCH_PATH}/:id/replay`, {
    method: 'POST',
    middleware: async (c, next) => {
      c.header('Cache-Control', 'no-store');
      return requireVerifiedUser(c, next);
    },
    handler: async (c) => {
      const user = await verifiedUserOf(c.req.raw.headers);
      if (!user) return c.json({ error: 'Authentication required' }, 401);
      const id = z.string().uuid().safeParse(c.req.param('id'));
      if (!id.success)
        return c.json({ error: 'Invalid research request id' }, 400);
      const text = await c.req.text();
      if (text.length > 2000)
        return c.json({ error: 'Request too large' }, 413);
      let body: { id: string };
      try {
        body = z.object({ id: z.string().uuid() }).parse(JSON.parse(text));
      } catch {
        return c.json({ error: 'Invalid replay request id' }, 400);
      }
      try {
        return c.json(
          await replayResearch(user.uid, id.data, body.id, c.req.raw.signal),
        );
      } catch (error) {
        return serviceFailure(c, error, true);
      }
    },
  }),
  registerApiRoute('/internal/research/extract', {
    method: 'POST',
    handler: async (c) => {
      if (!authorizedResearchWorker(c.req.header('Authorization')))
        return c.json({ error: 'Unauthorized' }, 401);
      try {
        const text = await c.req.text();
        if (text.length > 100_000)
          return c.json({ error: 'Request too large' }, 413);
        return c.json(
          await runSharedResearch(JSON.parse(text), c.req.raw.signal),
        );
      } catch {
        return c.json(
          {
            error:
              'Research extraction failed; completed checkpoints are preserved',
          },
          422,
        );
      }
    },
  }),
  ...researchInterestsRoutes,
];
