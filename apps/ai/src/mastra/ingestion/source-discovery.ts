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
  ): Candidate | undefined => {
    try {
      const url = validateSourceUrl(value, domains).href;
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
    const after = validateSourceUrl(finalUrl, domains);
    item.url = after.href;
    if (before.pathname === after.pathname) return;
    // A redirect is a new discovery lead; the previous URL/title cannot establish its scope.
    item.title = decodeURI(after.pathname);
    item.modelMatch = mentionsModel(item.title, scope.model, scope.brand);
    item.yearHint = yearHint(item.title);
    item.relevant = item.modelMatch;
    item.specification = specificationHint(item.title);
  };
  const crawl = async (deadline: AbortSignal) => {
    while (!deadline.aborted && inspected.size < 6) {
      const batch = ranked()
        .filter(
          (item) =>
            item.documentType === 'HTML' &&
            !inspected.has(sourceKey(item.url)) &&
            item.depth <= 2,
        )
        .slice(0, Math.min(2, 6 - inspected.size));
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
                domains,
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
      .slice(0, Math.max(0, 2 - metadataProbed.size));
    await Promise.all(
      batch.map(async (item) => {
        metadataProbed.add(sourceKey(item.url));
        try {
          const metadata = await probeSourceMetadata(
            item.url,
            phase(6500),
            domains,
          );
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
    // A usable brochure from the model page saves a model call. Explicit year conflicts require search.
    const usableBrochure = ranked().some(
      (item) =>
        item.relevant &&
        item.specification &&
        item.documentType === 'PDF' &&
        item.availability === 'READABLE' &&
        (item.yearHint === null || item.yearHint === scope.modelYear),
    );
    if (!usableBrochure && !signal.aborted) {
      try {
        const grounded = await search(
          { ...input, ...scope },
          domains,
          phase(40000),
        );
        parent?.throwIfAborted();
        searchStatus = 'COMPLETED';
        for (const source of grounded)
          add(source.title, source.url, 'WEB_SEARCH');
      } catch {
        parent?.throwIfAborted();
        searchStatus = 'FAILED';
      }
      await crawl(phase(10000));
      await probePdfs();
    }
  } else
    warnings.push(
      'This manufacturer has no configured approved domain. An operator must extend the source policy before automatic research can use it.',
    );
  parent?.throwIfAborted();
  if (stats.pageFailures)
    warnings.push(
      'Some official pages could not be read. Grounded links may still be available; unavailable pages are not verified sources.',
    );
  if (searchStatus === 'FAILED')
    warnings.push(
      'Grounded search was unavailable. Any returned official-site candidates remain usable discovery leads.',
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
      'Official links were found, but none matched the requested model. These are not substitutes for the requested vehicle.',
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
      ? 'Official source candidates found. Vehicle and model-year applicability still needs to be checked in the documents.'
      : 'Automatic official-source discovery found no usable candidate within its bounds. Explain the unavailable or unsupported scope; a failed lookup does not prove that the vehicle or its specifications do not exist.',
  };
}
