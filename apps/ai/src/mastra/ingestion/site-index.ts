import { downloadSource, sourceDomains, validateSourceUrl } from './source';

/**
 * Official model pages found without a search engine: the manufacturer's
 * sitemap (announced in robots.txt, else /sitemap.xml) is scanned for pages
 * about the model, and when a site publishes no usable sitemap the known
 * model-page path patterns of the approved domains are probed. Everything
 * goes through the pinned-DNS downloader and the approved-domain check.
 */
const PATH_TEMPLATES: Record<string, string[]> = {
  'ford.com.br': [
    '/picapes/{model}/',
    '/suvs/{model}/',
    '/carros/{model}/',
    '/utilitarios/{model}/',
  ],
  'toyota.com.br': ['/modelos/{model}'],
  'nissan.com.br': [
    '/veiculos/modelos/{model}.html',
    '/veiculos/modelos/novo-{model}.html',
    '/veiculos/modelos/nova-{model}.html',
  ],
};
/** Path segments of pages that never present specifications. */
const IGNORED_SEGMENTS =
  /^(support|servico.*|service|revisao.*|acessorios|galeria|gallery|design|test-drive|content|noticias|news|blog|central-conhecimento|financ.*|seguro.*|pecas|ofertas|promocoes|concession.*|manuais|owner-manuals)$/;
/** Segments of pages that usually present every version of a model. */
const PREFERRED_SEGMENTS = /compare|versoes|versao|ficha|especific|catalog/;
const MAX_SITEMAP_FILES = 4;
const MAX_MODEL_PAGES = 3;
const FETCH_TIMEOUT_MS = 20000;
const CACHE_TTL_MS = 15 * 60 * 1000;

export interface ModelPage {
  url: string;
  /** Page body when the probe downloaded it, so callers need not fetch twice. */
  html?: string;
}

/** Lower-case ASCII slug: `Corolla Cross` → `corolla-cross`. */
export function slugOf(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Approved domains whose first label is the brand (`ford` → `ford.com.br`). */
export function brandDomains(
  brand: string,
  domains = sourceDomains(),
): string[] {
  const slug = slugOf(brand);
  return domains.filter((domain) => domain.split('.')[0] === slug);
}

async function fetchText(
  url: string,
  signal: AbortSignal,
  domains: string[],
): Promise<{ url: string; mime: string; text: string } | undefined> {
  try {
    const response = await downloadSource(
      url,
      AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
      domains,
    );
    return {
      url: response.url.href,
      mime: response.mime,
      text: response.bytes.toString('utf8'),
    };
  } catch {
    return undefined;
  }
}

function locations(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
}

const sitemapCache = new Map<string, { expires: number; urls: string[] }>();

/** Every page URL the domain's sitemap lists; empty when there is none. */
export async function sitemapUrls(
  domain: string,
  signal: AbortSignal,
  domains = sourceDomains(),
): Promise<string[]> {
  const hit = sitemapCache.get(domain);
  if (hit && hit.expires > Date.now()) return hit.urls;
  const origin = `https://www.${domain}`;
  const robots = await fetchText(`${origin}/robots.txt`, signal, domains);
  const announced = (robots?.text ?? '').split('\n').flatMap((line) => {
    const match = /^\s*sitemap:\s*(\S+)/i.exec(line);
    if (!match?.[1]) return [];
    try {
      return [validateSourceUrl(match[1], [domain]).href];
    } catch {
      return [];
    }
  });
  const queue = announced.length ? announced : [`${origin}/sitemap.xml`];
  const urls: string[] = [];
  const visited = new Set<string>();
  while (queue.length && visited.size < MAX_SITEMAP_FILES) {
    const next = queue.shift();
    if (!next || visited.has(next)) continue;
    visited.add(next);
    const file = await fetchText(next, signal, [domain]);
    if (!file || !/xml/.test(file.mime)) continue;
    if (/<sitemapindex/i.test(file.text)) {
      for (const child of locations(file.text)) {
        try {
          queue.push(validateSourceUrl(child, [domain]).href);
        } catch {
          // Sitemaps on other hosts are ignored.
        }
      }
    } else urls.push(...locations(file.text));
  }
  sitemapCache.set(domain, { expires: Date.now() + CACHE_TTL_MS, urls });
  return urls;
}

/** Whether a sitemap URL is a page about the model (not support, news, ...). */
export function isModelPage(url: string, model: string): boolean {
  const slug = slugOf(model);
  let segments: string[];
  try {
    segments = new URL(url).pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.replace(/\.html?$/, ''));
  } catch {
    return false;
  }
  if (segments.length > 4 || segments.some((s) => IGNORED_SEGMENTS.test(s)))
    return false;
  return segments.some(
    (segment) =>
      segment === slug ||
      segment === `novo-${slug}` ||
      segment === `nova-${slug}` ||
      segment === `new-${slug}`,
  );
}

function rank(url: string): number {
  const path = new URL(url).pathname;
  return (PREFERRED_SEGMENTS.test(path) ? 0 : 1000) + path.length;
}

/**
 * Official pages about one model on the brand's approved domain: sitemap
 * matches ranked with version-comparison pages first, else probed
 * well-known paths. Empty when the brand has no approved domain.
 */
export async function wellKnownModelPages(
  brand: string,
  model: string,
  signal: AbortSignal,
  domains = sourceDomains(),
): Promise<ModelPage[]> {
  const pages: ModelPage[] = [];
  for (const domain of brandDomains(brand, domains)) {
    const listed = (await sitemapUrls(domain, signal, domains))
      .filter((url) => isModelPage(url, model))
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, MAX_MODEL_PAGES)
      .map((url) => ({ url }));
    if (listed.length) {
      pages.push(...listed);
      continue;
    }
    const slug = slugOf(model);
    const probes = await Promise.all(
      (PATH_TEMPLATES[domain] ?? []).map((template) =>
        fetchText(
          `https://www.${domain}${template.replace('{model}', slug)}`,
          signal,
          domains,
        ),
      ),
    );
    for (const probe of probes)
      if (probe && probe.mime === 'text/html')
        pages.push({ url: probe.url, html: probe.text });
  }
  const seen = new Set<string>();
  return pages.filter((page) => {
    const key = page.url.replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
