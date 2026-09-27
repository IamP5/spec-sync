import { z } from 'zod';

import { displayValue, safeSourceUrl } from '../util/knowledge-display';
import { parseResult } from '../util/parse-result';

/** The knowledge tools the knowledge card renders (web `chat-tools.ts`). */
export const KNOWLEDGE_TOOLS = [
  'listComparisonAttributes',
  'resolveComparisonConcepts',
  'findConfigurationsByCapabilities',
  'searchReviewEvidence',
  'getRelatedReviews',
  'getEvidenceExcerpt',
  'discoverVehicleContent',
  'discoverVehicleSpecificationSources',
] as const;

export const knowledgeResultSchema = z.object({
  status: z.string().optional(),
  message: z.string().optional(),
  items: z.array(z.record(z.unknown())).optional(),
  warnings: z.unknown().optional(),
});
export type KnowledgeResult = z.infer<typeof knowledgeResultSchema>;
export type KnowledgeItem = Record<string, unknown>;

/** Lookups the agent runs for itself; they surface only when they fail. */
const INTERNAL_TOOLS = new Set([
  'searchVehicleConfigurations',
  'listComparisonAttributes',
  'resolveComparisonConcepts',
]);

export type KnowledgeView =
  /** An internal lookup that worked: nothing to show. */
  | { kind: 'hidden' }
  /** One quiet line in the reply column instead of a card. */
  | { kind: 'quiet'; title: string; line: string; warnings: string[] }
  | {
      kind: 'card';
      title: string;
      message?: string;
      specificationDiscovery: boolean;
      warnings: string[];
      items: KnowledgeItem[];
    };

/**
 * How a knowledge tool result reads (web `KnowledgeResultCard`). Only a
 * result with items earns a card. A failure, an empty result or a pending
 * call is one quiet line; the raw tool result stays in the activity view.
 */
export function knowledgeView(
  name: string,
  complete: boolean,
  resultText: unknown,
): KnowledgeView {
  const result = parseResult(resultText, knowledgeResultSchema);
  const internal = INTERNAL_TOOLS.has(name);
  const failed =
    ['ERROR', 'UNAVAILABLE'].includes(result?.status ?? '') ||
    (complete && !result);
  if (internal && !failed) return { kind: 'hidden' };
  const specificationDiscovery = name === 'discoverVehicleSpecificationSources';
  const emptyContent =
    name === 'discoverVehicleContent' && result?.status === 'EMPTY';
  const title = emptyContent ? 'External content search' : toolTitle(name);
  const warnings = discoveryWarnings(result);
  if (!result)
    return {
      kind: 'quiet',
      title,
      line: complete ? 'No valid result returned.' : 'Retrieving information…',
      warnings,
    };
  if (result.items?.length)
    return {
      kind: 'card',
      title,
      message: result.message || undefined,
      specificationDiscovery,
      // Warnings belong to source discovery; other tools never show them.
      warnings: specificationDiscovery ? warnings : [],
      items: result.items,
    };
  const line = failed
    ? 'Unavailable right now. Ask the assistant to try again.'
    : emptyContent
      ? 'No external links found for this search.'
      : result.message || 'No matching results.';
  return { kind: 'quiet', title, line, warnings };
}

function discoveryWarnings(result: KnowledgeResult | undefined): string[] {
  const warnings = z.array(z.string()).safeParse(result?.warnings);
  return warnings.success ? warnings.data : [];
}

export function toolTitle(name: string): string {
  return (
    (
      {
        searchVehicleConfigurations: 'Vehicle search',
        listComparisonAttributes: 'Available specifications',
        resolveComparisonConcepts: 'Specification identification',
        findConfigurationsByCapabilities:
          'Vehicles with the requested equipment',
        searchReviewEvidence: 'Reviews and reports',
        getRelatedReviews: 'Related reviews',
        getEvidenceExcerpt: 'Source excerpt and context',
        discoverVehicleContent: 'Articles, blogs and videos found',
        discoverVehicleSpecificationSources: 'Specification sources',
      } as Record<string, string>
    )[name] ?? 'Query result'
  );
}

export function knowledgeItemLabel(item: KnowledgeItem): string {
  return displayValue(
    item['title'] ??
      item['name'] ??
      item['label'] ??
      item['code'] ??
      'Evidence',
  );
}

/** A safe http(s) link; YouTube links start at the quoted second. */
export function knowledgeItemLink(item: KnowledgeItem): string | undefined {
  const href = safeSourceUrl(item['url']);
  if (!href) return undefined;
  const url = new URL(href);
  const seconds = item['startSeconds'];
  if (
    typeof seconds === 'number' &&
    seconds >= 0 &&
    ['www.youtube.com', 'youtube.com', 'youtu.be'].includes(url.hostname)
  )
    url.searchParams.set('t', String(Math.floor(seconds)));
  return url.href;
}

export function yearHint(item: KnowledgeItem): number | undefined {
  const value = item['yearHint'];
  return typeof value === 'number' && Number.isInteger(value)
    ? value
    : undefined;
}

export function sourceTypeLabel(value: unknown): string {
  return value === 'MANUFACTURER_WEBSITE'
    ? 'Manufacturer website'
    : value === 'LINKED_FROM_MANUFACTURER'
      ? 'Document linked from the manufacturer website'
      : 'External site — confirm authorship and evidence';
}
