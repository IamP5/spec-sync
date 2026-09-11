import { linkedSpecificationPages, sourceKey } from './linked-documents';
import {
  manufacturerDomains,
  manufacturerSiteDomains,
  modelPathTemplates,
  modelSlugs,
  officialSiteRoot,
  slugOf,
} from './manufacturers';
import { downloadSource, sourceDomains, validateSourceUrl } from './source';

export { slugOf } from './manufacturers';

const IGNORED_SEGMENTS =
  /^(support|servico.*|service|revisao.*|acessorios|galeria|gallery|design|test-drive|noticias|news|blog|central-conhecimento|financ.*|seguro.*|pecas|ofertas|promocoes|concession.*|manuais|owner-manuals)$/;
const PREFERRED_SEGMENTS = /compare|versoes|versao|ficha|especific|catalog/;
const MAX_SITEMAP_FILES = 4;
const FETCH_TIMEOUT_MS = 4000;

export interface ModelPage {
  url: string;
  /** Body of a successful probe; callers reuse it instead of downloading again. */
  html?: string;
}

export interface SiteDiagnostics {
  pagesInspected: number;
  pageFailures: number;
}

export function brandDomains(
  brand: string,
  domains = sourceDomains(),
): string[] {
  return manufacturerDomains(brand, domains);
}

async function fetchText(url: string, signal: AbortSignal) {
  if (signal.aborted) return undefined;
  try {
    const response = await downloadSource(
      url,
      AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
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
  return [
    ...xml.matchAll(
      /<(?:[a-z]+:)?loc\b[^>]*>\s*([^<\s]+)\s*<\/(?:[a-z]+:)?loc>/gi,
    ),
  ].flatMap((match) => {
    try {
      return match[1]
        ? [validateSourceUrl(match[1].replace(/&amp;/g, '&')).href]
        : [];
    } catch {
      return [];
    }
  });
}

/** No process cache: an unavailable sitemap must not poison subsequent research. */
export async function sitemapUrls(
  domain: string,
  signal: AbortSignal,
): Promise<string[]> {
  const origin = new URL(officialSiteRoot(domain)).origin;
  const robots = await fetchText(`${origin}/robots.txt`, signal);
  const announced = (robots?.text ?? '').split('\n').flatMap((line) => {
    const match = /^\s*sitemap:\s*(\S+)/i.exec(line);
    try {
      return match?.[1] ? [validateSourceUrl(match[1]).href] : [];
    } catch {
      return [];
    }
  });
  const queue = announced.length ? announced : [`${origin}/sitemap.xml`];
  const urls: string[] = [];
  const visited = new Set<string>();
  while (queue.length && visited.size < MAX_SITEMAP_FILES && !signal.aborted) {
    const batch: string[] = [];
    while (
      queue.length &&
      batch.length < 2 &&
      visited.size < MAX_SITEMAP_FILES
    ) {
      const next = queue.shift();
      if (!next || visited.has(next)) continue;
      visited.add(next);
      batch.push(next);
    }
    const files = await Promise.all(batch.map((url) => fetchText(url, signal)));
    for (const file of files) {
      if (!file || !/xml/i.test(file.mime)) continue;
      const links = locations(file.text);
      if (/<sitemapindex/i.test(file.text)) queue.push(...links);
      else urls.push(...links);
    }
  }
  return [...new Set(urls)];
}

/** Exact model path segments, allowing typography aliases but not other trims/models. */
export function isModelPage(url: string, model: string, brand = ''): boolean {
  try {
    const segments = new URL(url).pathname
      .split('/')
      .filter(Boolean)
      .map((segment) =>
        slugOf(decodeURIComponent(segment).replace(/\.html?$/i, '')),
      );
    if (
      segments.length > 8 ||
      segments.some((segment) => IGNORED_SEGMENTS.test(segment))
    )
      return false;
    const aliases = modelSlugs(model, brand).map((slug) =>
      slug.replace(/-/g, ''),
    );
    return segments.some((segment) =>
      aliases.includes(
        segment.replace(/^(novo|nova|new)-/, '').replace(/-/g, ''),
      ),
    );
  } catch {
    return false;
  }
}

function rank(url: string): number {
  const path = new URL(url).pathname;
  return (PREFERRED_SEGMENTS.test(path) ? 0 : 1000) + path.length;
}

/** Probe known paths alongside the index, then follow observed model links from the homepage. */
export async function wellKnownModelPages(
  brand: string,
  model: string,
  signal: AbortSignal,
  domains = sourceDomains(),
  stats?: SiteDiagnostics,
): Promise<ModelPage[]> {
  const pages: ModelPage[] = [];
  const fetched = new Map<string, Promise<ModelPage | undefined>>();
  const readPage = (url: string): Promise<ModelPage | undefined> => {
    const key = sourceKey(url);
    const existing = fetched.get(key);
    if (existing) return existing;
    if (fetched.size >= 10 || signal.aborted) return Promise.resolve(undefined);
    const pending = (async () => {
      if (stats) stats.pagesInspected++;
      const response = await fetchText(url, signal);
      if (!response || response.mime !== 'text/html') {
        if (stats) stats.pageFailures++;
        return undefined;
      }
      return { url: response.url, html: response.text };
    })();
    fetched.set(key, pending);
    return pending;
  };
  const readBatch = async (urls: string[]) => {
    for (let index = 0; index < urls.length && !signal.aborted; index += 2) {
      const results = await Promise.all(
        urls.slice(index, index + 2).map(readPage),
      );
      pages.push(
        ...results.filter(
          (page): page is Required<ModelPage> => page !== undefined,
        ),
      );
    }
  };
  for (const domain of manufacturerSiteDomains(brand, domains)) {
    if (signal.aborted) break;
    const origin = new URL(officialSiteRoot(domain)).origin;
    const probes = modelPathTemplates(domain)
      .flatMap((template) =>
        modelSlugs(model, brand).map(
          (slug) => `${origin}${template.replace('{model}', slug)}`,
        ),
      )
      .slice(0, 4);
    // A listed URL is only a lead; a dead sitemap must not suppress working paths.
    const [listed] = await Promise.all([
      sitemapUrls(domain, signal),
      readBatch(probes),
    ]);
    await readBatch(
      listed
        .filter((url) => isModelPage(url, model, brand))
        .sort((a, b) => rank(a) - rank(b))
        .slice(0, 3),
    );
    if (!pages.length && !signal.aborted) {
      const home = await readPage(officialSiteRoot(domain));
      if (home?.html)
        await readBatch(
          linkedSpecificationPages(
            home.html,
            home.url,
            model,
            brand,
            domains,
            true,
          )
            .map((link) => link.url)
            .slice(0, 3),
        );
    }
  }
  const seen = new Set<string>();
  return pages
    .filter((page) => {
      const key = sourceKey(page.url);
      if (seen.has(key) || !isModelPage(page.url, model, brand)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => rank(a.url) - rank(b.url))
    .slice(0, 4);
}
