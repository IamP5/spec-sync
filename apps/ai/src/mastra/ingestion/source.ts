import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';

import ipaddr from 'ipaddr.js';
import { type DefaultTreeAdapterMap, parse } from 'parse5';

import { transcribePdf } from './pdf-transcription';

export const sha256 = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
export const MAX_BYTES = 5_000_000;
const MAX_TEXT = 150_000;
const defaults = ['ford.com.br', 'toyota.com.br', 'nissan.com.br'];
export function validateSourceUrl(value: string, domains = defaults): URL {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !domains.some(
      (domain) =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    )
  )
    throw new Error('Use an HTTPS URL on an approved manufacturer domain.');
  return url;
}
export function publicAddress(address: string): boolean {
  try {
    return ipaddr.parse(address).range() === 'unicast';
  } catch {
    return false;
  }
}
/** Resolve once and pin the checked IPv4 address to prevent DNS rebinding. */
async function download(
  url: URL,
  signal: AbortSignal,
): Promise<{ bytes: Buffer; mime: string; redirect?: string }> {
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  const address = addresses[0]?.address;
  if (!address || !addresses.every((item) => publicAddress(item.address)))
    throw new Error('Source resolved to a forbidden network.');
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        signal,
        family: 4,
        lookup: (_host, options, callback) =>
          options.all
            ? callback(null, [{ address, family: 4 }])
            : callback(null, address, 4),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; SpecSync/1.0; +vehicle specification research)',
          Accept: 'text/html,application/pdf',
          'Accept-Encoding': 'identity',
        },
      },
      (response) => {
        if (
          response.statusCode &&
          [301, 302, 303, 307, 308].includes(response.statusCode)
        ) {
          const redirect = response.headers.location;
          response.destroy();
          if (!redirect) reject(new Error('Source redirect has no location.'));
          else resolve({ bytes: Buffer.alloc(0), mime: '', redirect });
          return;
        }
        if (response.statusCode !== 200) {
          response.destroy();
          reject(new Error(`Source returned HTTP ${response.statusCode}.`));
          return;
        }
        if (Number(response.headers['content-length'] ?? 0) > MAX_BYTES) {
          response.destroy();
          reject(new Error('Source is larger than 5 MB.'));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            response.destroy(new Error('Source is larger than 5 MB.'));
          } else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () =>
          resolve({
            bytes: Buffer.concat(chunks),
            mime: response.headers['content-type']?.split(';')[0]?.trim() ?? '',
          }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}
export function htmlText(html: string): { text: string; title: string } {
  const doc = parse(html);
  let title = '';
  let output = '';
  const ignored = new Set([
    'script',
    'style',
    'noscript',
    'svg',
    'nav',
    'footer',
  ]);
  const blocks = new Set([
    'p',
    'div',
    'section',
    'article',
    'h1',
    'h2',
    'h3',
    'h4',
    'li',
    'tr',
    'table',
    'br',
  ]);
  function visit(node: DefaultTreeAdapterMap['node']): void {
    if ('tagName' in node && ignored.has(node.tagName)) return;
    if (node.nodeName === '#text' && 'value' in node) {
      output += node.value.replace(/\s+/g, ' ');
      return;
    }
    if ('tagName' in node && node.tagName === 'title') {
      title = node.childNodes
        .map((child) => ('value' in child ? child.value : ''))
        .join('')
        .trim();
      return;
    }
    if ('tagName' in node && blocks.has(node.tagName)) output += '\n';
    if ('childNodes' in node) node.childNodes.forEach(visit);
    if ('tagName' in node && ['td', 'th'].includes(node.tagName))
      output += ' | ';
    if ('tagName' in node && blocks.has(node.tagName)) output += '\n';
  }
  visit(doc);
  return {
    title,
    text: output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n'),
  };
}
export async function pdfText(bytes: Uint8Array): Promise<string> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
  });
  try {
    const document = await task.promise;
    if (document.numPages > 60)
      throw new Error('Maximum 60 PDF pages per import.');
    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      let text = `Page ${number}\n`;
      for (const item of content.items)
        if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' | ');
      pages.push(text.trim());
      page.cleanup();
    }
    return pages.join('\n');
  } finally {
    await task.destroy();
  }
}

export interface CapturedSource {
  url: string;
  title: string;
  mimeType: string;
  originalBase64: string;
  originalSha256: string;
  text: string;
  textSha256: string;
  parserVersion: string;
  /** Number of PDF pages, 0 for HTML. */
  pageCount: number;
}

/** Approved source domains, overridable per deployment. */
export function sourceDomains(): string[] {
  return (
    process.env['SPECSYNC_INGESTION_SOURCE_DOMAINS'] ?? defaults.join(',')
  )
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean);
}

export interface DownloadedSource {
  url: URL;
  bytes: Buffer;
  mime: string;
}

/**
 * Downloads one approved manufacturer document, following at most four
 * redirects and checking every hop against the approved domains.
 */
export async function downloadSource(
  value: string,
  signal: AbortSignal,
  domains = sourceDomains(),
): Promise<DownloadedSource> {
  let url = validateSourceUrl(value, domains);
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(45000)]);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const response = await download(url, deadline);
    if (response.redirect) {
      url = validateSourceUrl(new URL(response.redirect, url).href, domains);
      continue;
    }
    return { url, bytes: response.bytes, mime: response.mime };
  }
  throw new Error('Too many source redirects.');
}

/**
 * Downloads one approved manufacturer document and turns it into line-based
 * evidence text: HTML keeps table separators, headings and footnotes; PDFs are
 * rendered and visually transcribed (embedded text alone misses image-based
 * specification tables). The returned text is what every evidence line range
 * refers to, so it is hashed and stored verbatim by the API.
 */
export async function captureSource(
  value: string,
  signal: AbortSignal,
): Promise<CapturedSource> {
  const { url, bytes, mime } = await downloadSource(value, signal);
  let text: string, title: string, parserVersion: string;
  let pageCount = 0;
  if (
    mime === 'application/pdf' &&
    bytes.subarray(0, 5).toString() === '%PDF-'
  ) {
    const embedded = await pdfText(bytes);
    pageCount = embedded
      .split('\n')
      .filter((line) => /^Page \d+$/.test(line)).length;
    signal.throwIfAborted();
    const transcript = await transcribePdf(
      bytes.toString('base64'),
      pageCount,
      signal,
    );
    text = transcript.text;
    parserVersion = transcript.parserVersion;
    title = decodeURIComponent(
      url.pathname.split('/').pop() ?? 'Manufacturer brochure',
    );
  } else if (mime === 'text/html') {
    ({ text, title } = htmlText(bytes.toString('utf8')));
    parserVersion = 'specsync-source-v1';
    signal.throwIfAborted();
    if (text.trim().length < 100)
      throw new Error(
        'No usable source text. Scanned PDFs require manual review.',
      );
  } else
    throw new Error('Only manufacturer HTML pages and PDFs are supported.');
  if (text.length > MAX_TEXT)
    throw new Error(
      'Source text exceeds 150,000 characters. Use a smaller document.',
    );
  return {
    url: url.href,
    title: title || url.hostname,
    mimeType: mime,
    originalBase64: bytes.toString('base64'),
    originalSha256: sha256(bytes),
    text,
    textSha256: sha256(text),
    parserVersion,
    pageCount,
  };
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_ENTRIES = 6;
const cache = new Map<string, { expires: number; source: CapturedSource }>();

/**
 * Capture with a short in-memory cache: the chat previews a source (one
 * download and, for PDFs, one visual transcription) and the run that follows
 * seconds later reuses the same capture instead of paying for it twice. The
 * cache is per process and bounded; nothing here is durable.
 */
export async function captureSourceCached(
  value: string,
  signal: AbortSignal,
): Promise<CapturedSource> {
  const now = Date.now();
  const hit = cache.get(value);
  if (hit && hit.expires > now) return hit.source;
  const source = await captureSource(value, signal);
  if (cache.size >= CACHE_ENTRIES) {
    const oldest = [...cache.entries()].sort(
      (a, b) => a[1].expires - b[1].expires,
    )[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(value, { expires: now + CACHE_TTL_MS, source });
  return source;
}

/** Test hook: forgets cached captures. */
export function clearSourceCache(): void {
  cache.clear();
}
