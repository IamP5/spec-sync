import { registerApiRoute } from '@mastra/core/server';
import { z } from 'zod';

import { requireVerifiedUser, verifiedUserOf } from '../identity';
import { researchRequest, ResearchServiceError } from './client';

const reviewSchema = z.object({
  review: z.object({
    draftHash: z.string().min(1).max(100),
    baseRevision: z.number().int().nonnegative(),
    reason: z.string().trim().min(1).max(4000),
    configurations: z
      .array(
        z.object({
          configuration: z.number().int().nonnegative(),
          identityConfirmed: z.boolean(),
          selectedClaims: z.array(z.number().int().nonnegative()).max(100),
        }),
      )
      .min(1)
      .max(8),
  }),
});
const runSchema = z.object({
  result: z.object({ id: z.string().uuid() }).passthrough(),
});

/** Browser identity is verified here; the API resolves its private request to the existing run. */
export const researchReviewRoutes = ['', '/publish', '/source'].map((suffix) =>
  registerApiRoute(`/chat/research/:id/review${suffix}`, {
    method: suffix === '/publish' ? 'POST' : 'GET',
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
      const path = `/users/${encodeURIComponent(user.uid)}/requests/${id.data}/review${suffix}`;
      try {
        if (suffix === '/source') {
          const source = await researchRequest(
            'GET',
            path,
            undefined,
            z.object({ base64: z.string(), mimeType: z.string() }),
            c.req.raw.signal,
          );
          c.header('Content-Type', 'application/octet-stream');
          c.header(
            'Content-Disposition',
            `attachment; filename="${id.data}${source.mimeType === 'application/pdf' ? '.pdf' : '.html'}"`,
          );
          return c.body(Buffer.from(source.base64, 'base64'));
        }
        let body: z.infer<typeof reviewSchema> | undefined;
        if (suffix === '/publish') {
          const text = await c.req.text();
          if (text.length > 20_000)
            return c.json({ error: 'Request too large' }, 413);
          try {
            body = reviewSchema.parse(JSON.parse(text));
          } catch {
            return c.json(
              {
                error:
                  'Select evidenced claims, confirm their identity and provide a review reason.',
              },
              400,
            );
          }
        }
        return c.json(
          await researchRequest(
            body ? 'POST' : 'GET',
            path,
            body,
            runSchema,
            c.req.raw.signal,
          ),
        );
      } catch (error) {
        if (
          error instanceof ResearchServiceError &&
          [404, 422].includes(error.status)
        )
          return c.json(
            {
              error:
                suffix === '/publish'
                  ? 'The review is unavailable or changed. Refresh the draft and confirm your selection again.'
                  : 'Research review not found or no longer active.',
            },
            suffix === '/publish' ? 422 : 404,
          );
        return c.json({ error: 'Research review service unavailable' }, 503);
      }
    },
  }),
);
