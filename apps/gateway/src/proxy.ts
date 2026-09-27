import { proxy } from 'hono/proxy';

import type { UserIdentity } from './identity.js';

const requestHeaders = [
  'accept',
  'accept-language',
  'content-type',
  'if-none-match',
  'if-modified-since',
  'last-event-id',
  'range',
  'if-range',
];
const responseHeaders = new Set([
  'content-type',
  'cache-control',
  'etag',
  'last-modified',
  'content-disposition',
  'content-range',
  'accept-ranges',
  'retry-after',
  'vary',
  'www-authenticate',
]);

/**
 * How the verified ID token reaches an upstream. The API is an OAuth 2.0 resource server: it gets
 * the token as `Authorization: Bearer`, validates the JWT and authorises by its `roles` claim.
 * The AI service reads it from `x-specsync-token`. Cloud Run IAM always uses
 * `x-serverless-authorization`, so the two never collide.
 */
export type IdentityTokenHeader = 'authorization' | 'x-specsync-token';

/** Fixed upstreams only; identity and Cloud Run credentials never come from browser headers. */
export async function forward(
  request: Request,
  origin: string,
  path: string,
  user: UserIdentity,
  invocationToken: string | undefined,
  identityToken: string | undefined,
  fetcher: typeof fetch = fetch,
  identityTokenHeader: IdentityTokenHeader = 'x-specsync-token',
): Promise<Response> {
  const url = new URL(origin);
  // Assignment prevents //evil.example and encoded paths from replacing the upstream host.
  url.pathname = path;
  url.search = new URL(request.url).search;
  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set(
    'x-specsync-user',
    Buffer.from(JSON.stringify(user)).toString('base64url'),
  );
  if (identityToken)
    headers.set(
      identityTokenHeader,
      identityTokenHeader === 'authorization'
        ? `Bearer ${identityToken}`
        : identityToken,
    );
  if (invocationToken)
    headers.set('x-serverless-authorization', invocationToken);
  const upstream = await proxy(url, {
    raw: request,
    headers,
    customFetch: fetcher,
    redirect: 'manual',
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(300000)]),
  });
  // Redirects must never replay credentials to a different origin or expose private URLs.
  if (
    upstream.status >= 300 &&
    upstream.status < 400 &&
    upstream.status !== 304
  ) {
    await upstream.body?.cancel();
    return Response.json(
      { error: 'Unexpected upstream redirect' },
      { status: 502 },
    );
  }
  for (const name of [...upstream.headers.keys()]) {
    if (!responseHeaders.has(name)) upstream.headers.delete(name);
  }
  upstream.headers.set('cache-control', 'private, no-store');
  return upstream;
}
