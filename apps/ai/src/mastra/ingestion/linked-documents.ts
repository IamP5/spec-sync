import { sourceDomains, validateSourceUrl } from './source';

/** Label or file-name words that mark a specification brochure. */
const SPECIFICATION_HINTS = [
  'ficha',
  'tecnic',
  'técnic',
  'especific',
  'catalog',
  'catálog',
  'brochure',
  'folheto',
  'versoes',
  'versões',
  'specs',
];
/** Label or file-name words that mark other documents (manuals, e-books, terms). */
const OTHER_HINTS = [
  'manual',
  'ebook',
  'e-book',
  'implementador',
  'garantia',
  'termo',
  'regulamento',
  'contrato',
];
const MAX_LINKS = 20;
/** Characters before a reference searched for a JSON label. */
const LABEL_WINDOW = 400;

export interface LinkedDocument {
  /** Link label when the page has one, else the file name. */
  title: string;
  url: string;
  /** Labelled or named like a specification brochure rather than a manual or e-book. */
  specification: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Text the page attaches to one reference: the anchor text of a link with
 * that href, else a `title`/`label`/`name` JSON field shortly before it.
 * Sites that name brochures by UUID only carry the meaning in these labels.
 */
function labelFor(html: string, reference: string, index: number): string {
  const anchor = new RegExp(
    `href=["']${escapeRegExp(reference)}["'][^>]*>\\s*(?:<[^>]+>\\s*)*([^<]{1,80}?)\\s*<`,
    'i',
  ).exec(html);
  if (anchor?.[1]?.trim()) return anchor[1].trim();
  const before = html.slice(Math.max(0, index - LABEL_WINDOW), index);
  const fields = [
    ...before.matchAll(/"(?:title|label|name)"\s*:\s*"([^"]{1,80})"/g),
  ];
  return fields.at(-1)?.[1]?.trim() ?? '';
}

/**
 * PDF documents one manufacturer page links, on approved domains only.
 * Manufacturer pages reference their brochures from markup and from embedded
 * JSON, so the raw HTML is scanned rather than only anchor elements.
 * Specification brochures come first; nothing here is downloaded.
 */
export function linkedPdfs(
  html: string,
  base: string,
  domains = sourceDomains(),
): LinkedDocument[] {
  const seen = new Set<string>();
  const documents: LinkedDocument[] = [];
  for (const match of html.matchAll(
    /["'(]((?:https?:)?\/?\/?[^"'()\s<>]*?\.pdf(?:[?#][^"'()\s<>]*)?)["')]/gi,
  )) {
    const raw = match[1];
    if (!raw) continue;
    let url: URL;
    try {
      url = validateSourceUrl(
        new URL(raw.replace(/\\\//g, '/'), base).href,
        domains,
      );
    } catch {
      continue;
    }
    url.hash = '';
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    const name = decodeURIComponent(url.pathname.split('/').pop() ?? '');
    const label = labelFor(html, raw, match.index);
    const words = `${label} ${name}`.toLowerCase();
    documents.push({
      title: label || name || url.hostname,
      url: url.href,
      specification:
        SPECIFICATION_HINTS.some((hint) => words.includes(hint)) &&
        !OTHER_HINTS.some((hint) => words.includes(hint)),
    });
    if (documents.length >= MAX_LINKS) break;
  }
  return documents.sort(
    (a, b) => Number(b.specification) - Number(a.specification),
  );
}
