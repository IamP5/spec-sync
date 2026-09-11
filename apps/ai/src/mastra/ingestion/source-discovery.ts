import { z } from 'zod';

import {
  linkedPdfs,
  linkedSpecificationPages,
  otherDocumentHint,
  sourceKey,
  specificationHint,
} from './linked-documents';
import { canonicalScope, mentionsModel } from './manufacturers';
import {
  brandDomains,
  type SiteDiagnostics,
  wellKnownModelPages,
} from './site-index';
import {
  downloadSource,
  MAX_BYTES,
  probeSourceMetadata,
  validateSourceUrl,
} from './source';

export const discoveredItemSchema = z.object({
  title: z.string(),
  url: z.string(),
  documentType: z.enum(['PDF', 'HTML']),
  applicability: z.literal('UNVERIFIED'),
  sourceType: z.enum([
    'MANUFACTURER_WEBSITE',
    'LINKED_FROM_MANUFACTURER',
    'EXTERNAL_WEBSITE',
  ]),
  linkedFrom: z.string().optional(),
  provenance: z.enum(['OFFICIAL_SITE', 'PAGE_LINK', 'WEB_SEARCH']),
  modelMatch: z.boolean(),
  yearHint: z.number().nullable(),
  availability: z.enum(['READABLE', 'OVERSIZE', 'UNREACHABLE', 'UNKNOWN']),
  byteLength: z.number().nullable(),
});
export const discoveryResultSchema = z.object({
  status: z.enum(['OK', 'EMPTY', 'ERROR']),
  items: z.array(discoveredItemSchema),
  message: z.string(),
  warnings: z.array(z.string()),
  resolvedScope: z.object({
    brand: z.string(),
    model: z.string(),
    modelYear: z.number(),
    market: z.literal('BR'),
  }),
  diagnostics: z.object({
    pagesInspected: z.number(),
    pageFailures: z.number(),
    search: z.enum(['SKIPPED', 'COMPLETED', 'FAILED']),
  }),
});
type Item = z.infer<typeof discoveredItemSchema>;
type Candidate = Item & {
  html?: string;
  relevant: boolean;
  specification: boolean;
  depth: number;
};
export interface DiscoveryScope {
  brand: string;
  model: string;
  modelYear: number;
  configuration?: string;
}
type Search = (
  scope: DiscoveryScope,
  domains: string[],
  signal: AbortSignal,
  stage: 'official' | 'secondary',
) => Promise<Array<{ title: string; url: string }>>;

/** Title/URL metadata only; never derive a year from the request or page copyright. */
function yearHint(value: string): number | null {
  const years = [...new Set(value.match(/\b(?:19|20|21)\d{2}\b/g) ?? [])];
  return years.length === 1 ? Number(years[0]) : null;
}

/** Discovery is bounded, unverified and independent from shared document capture. */
export async function discoverOfficialSources(
  input: DiscoveryScope,
  search: Search,
  parent?: AbortSignal,
): Promise<z.infer<typeof discoveryResultSchema>> {
  parent?.throwIfAborted();
  const signal = parent
    ? AbortSignal.any([parent, AbortSignal.timeout(90000)])
    : AbortSignal.timeout(90000);
  const phase = (ms: number) =>
    AbortSignal.any([signal, AbortSignal.timeout(ms)]);
  const scope = canonicalScope(input.brand, input.model, input.modelYear);
  const domains = brandDomains(scope.brand);
  const preferred = (value: string) => {
    const host = new URL(value).hostname;
    return domains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  };
  const sourceType = (url: string, linkedFrom?: string): Item['sourceType'] =>
    preferred(url)
      ? 'MANUFACTURER_WEBSITE'
      : linkedFrom && preferred(linkedFrom)
        ? 'LINKED_FROM_MANUFACTURER'
        : 'EXTERNAL_WEBSITE';
  const stats: SiteDiagnostics = { pagesInspected: 0, pageFailures: 0 };
  let searchStatus: 'SKIPPED' | 'COMPLETED' | 'FAILED' = 'SKIPPED';
  const candidates = new Map<string, Candidate>();
  const inspected = new Set<string>();
  const metadataProbed = new Set<string>();
  const warnings: string[] = [];
  const add = (
    title: string,
    value: string,
    provenance: Item['provenance'],
    html?: string,
    parentRelevant = false,
    depth = 0,
    linkedFrom?: string,
  ): Candidate | undefined => {
    try {
      const url = validateSourceUrl(value).href;
      const key = sourceKey(url);
      const existing = candidates.get(key);
      if (existing) {
        existing.html ??= html;
        return existing;
      }
      if (candidates.size >= 40) return undefined;
      const words = `${title} ${decodeURI(new URL(url).pathname)}`;
      if (otherDocumentHint(words)) return undefined;
      const modelMatch = mentionsModel(words, scope.model, scope.brand);
      const candidate: Candidate = {
        title,
        url,
        documentType: /\.pdf$/i.test(new URL(url).pathname) ? 'PDF' : 'HTML',
        applicability: 'UNVERIFIED',
        sourceType: sourceType(url, linkedFrom),
        ...(linkedFrom ? { linkedFrom } : {}),
        provenance,
        modelMatch,
        yearHint: yearHint(words),
        availability: html === undefined ? 'UNKNOWN' : 'READABLE',
        byteLength: null,
        relevant: modelMatch || parentRelevant,
        specification: specificationHint(words),
        html,
        depth,
      };
      candidates.set(key, candidate);
      return candidate;
    } catch {
      return undefined;
    }
  };
  const score = (item: Candidate) =>
    (item.relevant ? 60 : 0) +
    (item.sourceType === 'EXTERNAL_WEBSITE' ? 0 : 20) +
    (item.specification ? 40 : 0) +
    (item.yearHint === scope.modelYear
      ? 30
      : item.yearHint === null
        ? 0
        : -120) +
    (item.availability === 'OVERSIZE'
      ? -1000
      : item.availability === 'UNREACHABLE'
        ? -500
        : item.availability === 'READABLE'
          ? 35
          : 0) +
    (item.documentType === 'PDF' ? 10 : 0);
  const ranked = () =>
    [...candidates.values()].sort((a, b) => score(b) - score(a));
  const retarget = (item: Candidate, finalUrl: string) => {
    const before = new URL(item.url);
    const after = validateSourceUrl(finalUrl);
    if (preferred(before.href) && !preferred(after.href))
      item.linkedFrom ??= before.href;
    item.url = after.href;
    item.sourceType = sourceType(item.url, item.linkedFrom);
    if (before.pathname === after.pathname) return;
    // A redirect is a new discovery lead; the previous URL/title cannot establish its scope.
    item.title = decodeURI(after.pathname);
    item.modelMatch = mentionsModel(item.title, scope.model, scope.brand);
    item.yearHint = yearHint(item.title);
    item.relevant = item.modelMatch;
    item.specification = specificationHint(item.title);
  };
  const crawl = async (deadline: AbortSignal, limit = 6) => {
    while (!deadline.aborted && inspected.size < limit) {
      const batch = ranked()
        .filter(
          (item) =>
            item.documentType === 'HTML' &&
            !inspected.has(sourceKey(item.url)) &&
            item.depth <= 2,
        )
        .slice(0, Math.min(2, limit - inspected.size));
      if (!batch.length) break;
      await Promise.all(
        batch.map(async (item) => {
          inspected.add(sourceKey(item.url));
          try {
            if (item.html === undefined) {
              stats.pagesInspected++;
              const response = await downloadSource(
                item.url,
                AbortSignal.any([deadline, AbortSignal.timeout(5000)]),
              );
              retarget(item, response.url.href);
              item.byteLength = response.bytes.length;
              if (response.mime !== 'text/html') {
                item.availability = 'UNKNOWN';
                return;
              }
              item.html = response.bytes.toString('utf8');
            }
            item.availability = 'READABLE';
            for (const pdf of linkedPdfs(item.html, item.url, domains))
              add(
                pdf.title,
                pdf.url,
                'PAGE_LINK',
                undefined,
                item.relevant,
                item.depth + 1,
                item.url,
              );
            if (item.depth < 2)
              for (const link of linkedSpecificationPages(
                item.html,
                item.url,
                scope.model,
                scope.brand,
                domains,
              ))
                add(
                  link.title,
                  link.url,
                  'PAGE_LINK',
                  undefined,
                  item.relevant,
                  item.depth + 1,
                  item.url,
                );
          } catch {
            stats.pageFailures++;
            item.availability = 'UNREACHABLE';
          }
        }),
      );
    }
  };
  const probePdfs = async () => {
    const batch = ranked()
      .filter(
        (item) =>
          item.documentType === 'PDF' &&
          item.relevant &&
          !metadataProbed.has(sourceKey(item.url)),
      )
      .slice(0, Math.min(2, Math.max(0, 6 - metadataProbed.size)));
    await Promise.all(
      batch.map(async (item) => {
        metadataProbed.add(sourceKey(item.url));
        try {
          const metadata = await probeSourceMetadata(item.url, phase(6500));
          retarget(item, metadata.url);
          item.byteLength = metadata.byteLength;
          item.availability =
            metadata.byteLength !== null && metadata.byteLength > MAX_BYTES
              ? 'OVERSIZE'
              : metadata.mime === 'application/pdf'
                ? 'READABLE'
                : 'UNKNOWN';
        } catch {
          item.availability = 'UNREACHABLE';
        }
      }),
    );
  };
  if (domains.length) {
    try {
      const pages = await wellKnownModelPages(
        scope.brand,
        scope.model,
        phase(15000),
        domains,
        stats,
      );
      for (const page of pages)
        add(new URL(page.url).pathname, page.url, 'OFFICIAL_SITE', page.html);
    } catch {
      warnings.push(
        'The official site index was unavailable; grounded search remains available.',
      );
    }
    parent?.throwIfAborted();
    await crawl(phase(10000));
    await probePdfs();
    parent?.throwIfAborted();
  }
  const usableSource = () =>
    ranked().some(
      (item) =>
        item.relevant &&
        item.specification &&
        item.availability === 'READABLE' &&
        (item.yearHint === null || item.yearHint === scope.modelYear),
    );
  // Seeds guide the first pass. Unknown brands and external hosting are never blocked.
  for (const stage of ['official', 'secondary'] as const) {
    if (usableSource() || signal.aborted) break;
    try {
      const grounded = await search(
        { ...input, ...scope },
        domains,
        phase(25000),
        stage,
      );
      parent?.throwIfAborted();
      searchStatus = 'COMPLETED';
      for (const source of grounded)
        add(source.title, source.url, 'WEB_SEARCH');
    } catch {
      parent?.throwIfAborted();
      searchStatus = 'FAILED';
      warnings.push(
        `${stage === 'official' ? 'Official-source' : 'Secondary-source'} web search was unavailable.`,
      );
    }
    await crawl(phase(8000), Math.min(12, inspected.size + 3));
    await probePdfs();
  }
  parent?.throwIfAborted();
  if (stats.pageFailures)
    warnings.push(
      'Some source pages could not be read. Grounded links may still be available; unavailable pages are not verified sources.',
    );
  if (searchStatus === 'FAILED')
    warnings.push(
      'Grounded search was unavailable. Any returned candidates remain discovery leads.',
    );
  if (signal.aborted)
    warnings.push(
      'The discovery time budget was reached; these are partial results.',
    );
  if ([...candidates.values()].some((item) => item.availability === 'OVERSIZE'))
    warnings.push(
      'Some PDFs exceed the 5 MB capture limit. Prefer an accessible model/specification HTML page or a smaller official document.',
    );
  if (
    [...candidates.values()].some(
      (item) => item.yearHint !== null && item.yearHint !== scope.modelYear,
    )
  )
    warnings.push(
      'Some title/URL clues mention another model year. Do not substitute those for the requested year without source evidence.',
    );
  if (candidates.size && !ranked().some((item) => item.relevant))
    warnings.push(
      'Source links were found, but none matched the requested model. These are not substitutes for the requested vehicle.',
    );
  if (
    ranked().some(
      (item) => item.relevant && item.sourceType === 'EXTERNAL_WEBSITE',
    )
  )
    warnings.push(
      'Some candidates are hosted outside the known manufacturer websites. Verify their publisher and distinguish secondary reporting from manufacturer evidence.',
    );
  const finalUrls = new Set<string>();
  const items = ranked()
    .filter((item) => {
      if (!item.relevant) return false;
      const key = sourceKey(item.url);
      if (finalUrls.has(key)) return false;
      finalUrls.add(key);
      return true;
    })
    .slice(0, 10)
    .map((item) => discoveredItemSchema.parse(item));
  return {
    status: items.length ? 'OK' : searchStatus === 'FAILED' ? 'ERROR' : 'EMPTY',
    items,
    resolvedScope: scope,
    diagnostics: { ...stats, search: searchStatus },
    warnings,
    message: items.length
      ? 'Specification source candidates found. Check publisher, evidence and vehicle/model-year applicability before using their claims.'
      : 'Official and secondary source searches found no usable candidate within their bounds. A failed lookup does not prove that the vehicle or its specifications do not exist.',
  };
}
