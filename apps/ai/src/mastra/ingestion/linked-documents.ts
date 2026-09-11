import { type DefaultTreeAdapterMap, parse, serialize } from 'parse5';

import { mentionsModel } from './manufacturers';
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
  'implementador',
  'garantia',
  'termo',
  'regulamento',
  'contrato',
  'resgate',
  'rescue',
  'proconve',
  'opacidade',
  'accessor',
  'acessor',
  'acessór',
];
const MAX_LINKS = 20;
/** Characters before a reference searched for a JSON label. */
const LABEL_WINDOW = 400;

export function specificationHint(text: string): boolean {
  const words = text.toLowerCase();
  return (
    SPECIFICATION_HINTS.some((hint) => words.includes(hint)) &&
    !otherDocumentHint(words)
  );
}

export function otherDocumentHint(text: string): boolean {
  return OTHER_HINTS.some((hint) => text.toLowerCase().includes(hint));
}

export function sourceKey(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()])
    if (/^(utm_.+|gclid|fbclid)$/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.href.replace(/\/$/, '');
}

function contentTree(html: string) {
  const doc = parse(html);
  const visit = (node: DefaultTreeAdapterMap['node']): void => {
    if (!('childNodes' in node)) return;
    node.childNodes = node.childNodes.filter(
      (child) =>
        !(
          'tagName' in child &&
          (/^(nav|footer)$|-(navigation|footer|header)$/.test(child.tagName) ||
            child.attrs.some(
              (attr) =>
                attr.name === 'role' &&
                /^(navigation|contentinfo)$/.test(attr.value),
            ))
        ),
    );
    node.childNodes.forEach(visit);
  };
  visit(doc);
  return doc;
}

function anchors(
  html: string,
  includeNavigation = false,
): Array<{ title: string; href: string }> {
  const links: Array<{ title: string; href: string }> = [];
  type Node = DefaultTreeAdapterMap['node'];
  const textOf = (node: Node): string =>
    'value' in node
      ? node.value
      : 'childNodes' in node
        ? node.childNodes.map(textOf).join(' ')
        : '';
  const visit = (node: Node): void => {
    if ('tagName' in node && node.tagName === 'a') {
      const href = node.attrs.find((attr) => attr.name === 'href')?.value;
      if (href)
        links.push({
          href,
          title: textOf(node).replace(/\s+/g, ' ').trim().slice(0, 150),
        });
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  };
  visit(includeNavigation ? parse(html) : contentTree(html));
  return links;
}

/** Follow a bounded set of relevant links actually published by an official page. */
export function linkedSpecificationPages(
  html: string,
  base: string,
  model: string,
  brand: string,
  domains = sourceDomains(),
  includeNavigation = false,
): Array<{ title: string; url: string }> {
  const seen = new Set<string>([sourceKey(base)]);
  const result: Array<{ title: string; url: string }> = [];
  for (const link of anchors(html, includeNavigation)) {
    try {
      const url = validateSourceUrl(new URL(link.href, base).href);
      const key = sourceKey(url.href);
      const words = `${url.pathname} ${link.title}`;
      if (
        seen.has(key) ||
        /\.pdf$/i.test(url.pathname) ||
        otherDocumentHint(words)
      )
        continue;
      if (
        !mentionsModel(words, model, brand) &&
        !(mentionsModel(base, model, brand) && specificationHint(words))
      )
        continue;
      if (
        /\/(?:noticias|news|blog|ofertas|concessionarias|servico-ao-cliente|support)(?:\/|$)/i.test(
          url.pathname,
        )
      )
        continue;
      seen.add(key);
      result.push({ title: link.title, url: url.href });
    } catch {
      // Unsupported schemes and local addresses are never returned or fetched.
    }
  }
  return result
    .sort(
      (a, b) =>
        Number(specificationHint(`${b.title} ${b.url}`)) -
          Number(specificationHint(`${a.title} ${a.url}`)) ||
        Number(preferredHost(b.url, domains)) -
          Number(preferredHost(a.url, domains)),
    )
    .slice(0, 6);
}

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
 * PDF documents linked by a source page, including external document hosting.
 * Manufacturer pages reference their brochures from markup and from embedded
 * JSON, so the raw HTML is scanned rather than only anchor elements.
 * Specification brochures come first; nothing here is downloaded.
 */
export function linkedPdfs(
  html: string,
  base: string,
  domains = sourceDomains(),
): LinkedDocument[] {
  html = serialize(contentTree(html));
  html = html
    .replace(/&#(?:34|x22);|&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/\\u0026/gi, '&');
  const seen = new Set<string>();
  const documents: LinkedDocument[] = [];
  for (const match of html.matchAll(
    /["'(]((?:https?:)?\/?\/?[^"'()\s<>]*?\.pdf(?:[?#][^"'()\s<>]*)?)["')]/gi,
  )) {
    const raw = match[1];
    if (!raw) continue;
    let url: URL;
    try {
      url = validateSourceUrl(new URL(raw.replace(/\\\//g, '/'), base).href);
    } catch {
      continue;
    }
    url.hash = '';
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    let name = url.pathname.split('/').pop() ?? '';
    try {
      name = decodeURIComponent(name);
    } catch {
      /* Keep malformed escapes as a file label. */
    }
    const label = labelFor(html, raw, match.index);
    const words = `${label} ${name}`.toLowerCase();
    documents.push({
      title: label || name || url.hostname,
      url: url.href,
      specification: specificationHint(words),
    });
    if (documents.length >= MAX_LINKS) break;
  }
  return documents.sort(
    (a, b) =>
      Number(b.specification) - Number(a.specification) ||
      Number(preferredHost(b.url, domains)) -
        Number(preferredHost(a.url, domains)),
  );
}

function preferredHost(value: string, domains: string[]): boolean {
  const host = new URL(value).hostname;
  return domains.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}
