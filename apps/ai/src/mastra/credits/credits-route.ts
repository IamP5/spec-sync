import { registerApiRoute } from '@mastra/core/server';

import { requireVerifiedUser, verifiedUserOf } from '../identity';
import { creditsEnabled, fetchWallet } from './credits-client';

/**
 * Path of the wallet read model. The web app reaches it as
 * `/ai/chat/credits` (nginx, `apps/web/proxy.conf.json` and the gateway strip
 * the `/ai` prefix). Rename only together with the credits client in apps/web.
 */
export const CHAT_CREDITS_PATH = '/chat/credits';

/**
 * The signed-in user's wallet: balance, the priced models and the recent runs.
 * `{ "enabled": false }` while the feature flag is off, so the browser can hide
 * every credits element without a second probe. A wallet that cannot be read is
 * a `503`, never an empty wallet, so the UI never shows a wrong balance.
 */
export const chatCreditsRoutes = [
  registerApiRoute(CHAT_CREDITS_PATH, {
    method: 'GET',
    middleware: requireVerifiedUser,
    handler: async (c) => {
      if (!creditsEnabled()) {
        return c.json({ enabled: false });
      }
      const user = await verifiedUserOf(c.req.raw.headers);
      if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
      }
      const wallet = await fetchWallet(user.uid);
      if (wallet.status !== 'OK') {
        return c.json({ error: 'Credits service unavailable' }, 503);
      }
      return c.json({ enabled: true, ...wallet.value });
    },
  }),
];
