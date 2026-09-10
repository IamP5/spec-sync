/**
 * Google Search grounding cites pages through
 * `https://vertexaisearch.cloud.google.com/grounding-api-redirect/...` links
 * that redirect once to the real page. Approved-domain checks and the links
 * shown to users need that real URL, so it is read from the redirect's
 * `Location` header. A bounded GET fallback handles HEAD responses without a
 * redirect. Only that Google host is requested; redirects are never followed.
 */
const GROUNDING_HOST = 'vertexaisearch.cloud.google.com';
const RESOLVE_TIMEOUT_MS = 10_000;
/** Grounding chunks looked at per discovery call. */
const MAX_CANDIDATES = 20;

export interface GroundedSource {
  title: string;
  url: string;
}

export function isGroundingRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === GROUNDING_HOST &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname.startsWith('/grounding-api-redirect/')
    );
  } catch {
    return false;
  }
}

/**
 * Real URL behind one grounding redirect link; the link itself for any other
 * URL, and `undefined` when the redirect cannot be resolved.
 */
export async function resolveGroundingUrl(
  value: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  if (!isGroundingRedirect(value)) return value;
  try {
    const timeout = AbortSignal.timeout(RESOLVE_TIMEOUT_MS);
    const deadline = signal ? AbortSignal.any([signal, timeout]) : timeout;
    for (const method of ['HEAD', 'GET'] as const) {
      deadline.throwIfAborted();
      const response = await fetch(value, {
        method,
        redirect: 'manual',
        signal: deadline,
      });
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (response.status >= 300 && response.status <= 399 && location)
        return new URL(location, value).href;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the URL sources of one grounded generation in parallel, keeping
 * their order and dropping the ones that cannot be resolved.
 */
export async function resolveGroundedSources(
  sources: ReadonlyArray<{
    payload: { sourceType: string; url?: unknown; title?: unknown };
  }>,
  signal?: AbortSignal,
): Promise<GroundedSource[]> {
  const candidates = sources
    .flatMap(({ payload }) =>
      payload.sourceType === 'url' && typeof payload.url === 'string'
        ? [
            {
              title: typeof payload.title === 'string' ? payload.title : '',
              url: payload.url,
            },
          ]
        : [],
    )
    .slice(0, MAX_CANDIDATES);
  const resolved = await Promise.all(
    candidates.map(async (candidate) => {
      const url = await resolveGroundingUrl(candidate.url, signal);
      return url ? { title: candidate.title, url } : undefined;
    }),
  );
  return resolved.filter((item): item is GroundedSource => item !== undefined);
}

/**
 * Grounding titles are often just the site's domain. The page path tells the
 * curator more when several links share one domain.
 */
export function describeSource(title: string, url: string): string {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    if (title && title.replace(/^www\./, '') !== domain) return title;
    const path = decodeURIComponent(parsed.pathname).replace(/\/+$/, '');
    return path ? `${domain}${path}` : domain;
  } catch {
    return title || url;
  }
}
