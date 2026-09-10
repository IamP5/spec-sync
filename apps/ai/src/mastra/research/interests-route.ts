import { registerApiRoute } from '@mastra/core/server';
import { z } from 'zod';

import { requireVerifiedUser, verifiedUserOf } from '../identity';
import {
  listResearchInterests,
  researchInterestInputSchema,
  ResearchServiceError,
  saveResearchInterest,
} from './client';

/** Contact profiles are loaded by the drawer, never supplied to the model or AG-UI history. */
export const researchInterestsRoutes = (['GET', 'POST'] as const).map(
  (method) =>
    registerApiRoute('/chat/research/:id/interests', {
      method,
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
        try {
          const signal = AbortSignal.any([
            c.req.raw.signal,
            AbortSignal.timeout(15_000),
          ]);
          if (method === 'GET')
            return c.json(
              await listResearchInterests(user.uid, id.data, signal),
            );
          const text = await c.req.text();
          if (text.length > 2000)
            return c.json({ error: 'Request too large' }, 413);
          let body;
          try {
            body = researchInterestInputSchema.parse(JSON.parse(text));
          } catch {
            return c.json(
              {
                error:
                  'Provide a display name and HTTPS contact link, or turn visibility off',
              },
              400,
            );
          }
          return c.json(
            await saveResearchInterest(user.uid, id.data, body, signal),
          );
        } catch (error) {
          if (
            error instanceof ResearchServiceError &&
            [404, 422].includes(error.status)
          )
            return c.json(
              { error: 'Research request not found or profile invalid' },
              404,
            );
          return c.json(
            { error: 'Interested people could not be loaded' },
            503,
          );
        }
      },
    }),
);
