import { type DefaultTreeAdapterMap, parseFragment } from 'parse5';

type HtmlNode = DefaultTreeAdapterMap['node'];

const LIMITS = {
  domNodes: 10_000,
  domDepth: 48,
  jsonCharacters: 120_000,
  stringCharacters: 16_000,
  jsonDepth: 10,
  entries: 80,
  fields: 4_000,
  outputCharacters: 80_000,
};
const ignoredTags = new Set([
  'script',
  'style',
  'noscript',
  'svg',
  'iframe',
  'object',
  'template',
  'nav',
  'header',
  'footer',
  'form',
  'input',
  'button',
  'select',
]);
const ignoredComponentWords = new Set([
  'nav',
  'navigation',
  'header',
  'footer',
  'menu',
  'login',
  'user',
  'form',
  'analytics',
  'cookie',
  'popup',
  'offers',
  'offer',
  'simulate',
  'negotiation',
  'bank',
  'geolocation',
  'whatsapp',
]);
const contentWords = new Set([
  'vehicle',
  'vehicles',
  'model',
  'models',
  'version',
  'versions',
  'trim',
  'trims',
  'configuration',
  'configurations',
  'feature',
  'features',
  'spec',
  'specs',
  'specification',
  'specifications',
  'equipment',
  'powertrain',
  'technical',
  'accordion',
  'table',
  'hero',
]);
const blockedWords = new Set([
  'secret',
  'key',
  'token',
  'password',
  'credential',
  'credentials',
  'auth',
  'authorization',
  'session',
  'account',
  'user',
  'client',
  'analytics',
  'tracking',
  'event',
  'onclick',
  'style',
  'css',
  'class',
  'theme',
  'config',
  'settings',
  'button',
  'modal',
  'form',
  'url',
  'href',
  'src',
  'link',
  'deeplink',
  'download',
  'file',
  'image',
  'photo',
  'picture',
  'icon',
  'rgb',
  'enable',
  'enabled',
  'disable',
  'disabled',
  'copyright',
  'cookie',
  'arrangement',
  'mobile',
  'desktop',
]);
const scalarWords = new Set([
  ...contentWords,
  'name',
  'title',
  'heading',
  'subtitle',
  'description',
  'text',
  'label',
  'value',
  'unit',
  'year',
  'engine',
  'power',
  'torque',
  'transmission',
  'drivetrain',
  'fuel',
  'capacity',
  'weight',
  'height',
  'length',
  'width',
  'wheelbase',
  'displacement',
  'gear',
  'seats',
  'battery',
  'range',
  'consumption',
  'acceleration',
  'speed',
  'towing',
  'payload',
  'condition',
  'qualifier',
  'qualifiers',
  'note',
  'notes',
  'footnote',
  'legend',
]);
const containerWords = new Set([
  ...contentWords,
  'items',
  'sections',
  'slides',
  'groups',
  'tables',
  'rows',
  'columns',
  'headers',
  'cells',
  'values',
  'qualifiers',
  'notes',
  'details',
  'content',
]);

function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function ignoredElement(node: HtmlNode): boolean {
  return (
    'tagName' in node &&
    (ignoredTags.has(node.tagName) ||
      words(node.tagName).some((word) => ignoredComponentWords.has(word)))
  );
}

function allowedKey(key: string, container: boolean): boolean {
  if (
    !/^[a-z][a-z0-9_-]{0,99}$/i.test(key) ||
    ['constructor', 'prototype'].includes(key.toLowerCase())
  )
    return false;
  const tokens = words(key);
  return (
    !tokens.some((word) => blockedWords.has(word)) &&
    tokens.some((word) => (container ? containerWords : scalarWords).has(word))
  );
}

/** Reads declarative page content only; binding expressions and scripts are never evaluated. */
export function embeddedHtmlContent(root: HtmlNode): string {
  const lines: string[] = [];
  let outputCharacters = 0;
  let visited = 0;
  let fields = 0;
  let section = 0;
  let truncated = false;

  function append(line: string): void {
    if (outputCharacters + line.length + 1 > LIMITS.outputCharacters) {
      truncated = true;
      return;
    }
    lines.push(line);
    outputCharacters += line.length + 1;
  }

  function plainContent(value: string): string {
    if (value.length > LIMITS.stringCharacters) {
      truncated = true;
      return '';
    }
    if (
      /^(?:https?:|data:|javascript:|\/\/|\/[^\s]+$)/i.test(value.trim()) ||
      /(?:©|copyright|\(c\))/i.test(value)
    )
      return '';
    const fragment = parseFragment(value);
    const text: string[] = [];
    let nodes = 0;
    function visit(node: HtmlNode, depth: number): void {
      if (++nodes > LIMITS.domNodes || depth > LIMITS.domDepth) {
        truncated = true;
        return;
      }
      if (ignoredElement(node)) return;
      if (node.nodeName === '#text' && 'value' in node)
        text.push(node.value.replace(/\s+/g, ' '));
      const block =
        'tagName' in node &&
        /^(?:p|div|section|article|h[1-6]|li|tr|table|br)$/.test(node.tagName);
      if (block) text.push('\n');
      if ('childNodes' in node)
        for (const child of node.childNodes) visit(child, depth + 1);
      if ('tagName' in node && ['td', 'th'].includes(node.tagName))
        text.push(' | ');
      if (block) text.push('\n');
    }
    visit(fragment, 0);
    return text
      .join('')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');
  }

  function project(
    value: unknown,
    path: string,
    depth: number,
    output: string[],
  ): void {
    if (++fields > LIMITS.fields || depth > LIMITS.jsonDepth) {
      truncated = true;
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > LIMITS.entries) truncated = true;
      value
        .slice(0, LIMITS.entries)
        .forEach((entry, index) =>
          project(entry, `${path}[${index}]`, depth + 1, output),
        );
    } else if (value !== null && typeof value === 'object') {
      const childLines: string[] = [];
      const entries = Object.entries(value);
      if (entries.length > LIMITS.entries) truncated = true;
      for (const [key, child] of entries.slice(0, LIMITS.entries)) {
        if (allowedKey(key, child !== null && typeof child === 'object'))
          project(child, `${path}.${key}`, depth + 1, childLines);
      }
      if (childLines.length)
        output.push(`${path} {`, ...childLines, `} ${path}`);
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      const content = plainContent(String(value));
      if (content) output.push(`${path}: ${content}`);
    }
  }

  function inspect(node: DefaultTreeAdapterMap['element']): void {
    const componentWords = words(node.tagName);
    const contentComponent =
      node.tagName.includes('-') &&
      (componentWords.some((word) => contentWords.has(word)) ||
        (componentWords.includes('rich') && componentWords.includes('text')));
    const attributes: { name: string; lines: string[]; versions: boolean }[] =
      [];
    for (const attribute of node.attrs) {
      const name = attribute.name.replace(/^:/, '');
      const isDeclaredContent =
        name.startsWith('data-') &&
        words(name).some((word) => contentWords.has(word));
      if (!contentComponent && !isDeclaredContent) continue;
      const value = attribute.value.trim();
      if (!value) continue;
      const structured = value.startsWith('[') || value.startsWith('{');
      if (!allowedKey(name, structured)) continue;
      const projected: string[] = [];
      if (structured || attribute.name.startsWith(':')) {
        if (value.length > LIMITS.jsonCharacters) {
          truncated = true;
          continue;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(value);
        } catch {
          continue;
        }
        project(parsed, name, 0, projected);
      } else {
        const content = plainContent(value);
        if (content) projected.push(`${name}: ${content}`);
      }
      if (projected.length)
        attributes.push({
          name,
          lines: projected,
          versions: words(name).some((word) =>
            ['versions', 'trims', 'configurations'].includes(word),
          ),
        });
    }
    if (!attributes.length) return;
    append(`[Embedded page content: ${node.tagName}, section ${++section}]`);
    for (const attribute of attributes) {
      append(
        attribute.versions
          ? `[Declared version content: ${attribute.name}; each indexed record has its own scope.]`
          : `[Page content: ${attribute.name}; applicability to individual versions is not established.]`,
      );
      for (const line of attribute.lines) append(line);
    }
    append('[End embedded page content]');
  }

  function visit(node: HtmlNode, depth: number): void {
    if (
      ++visited > LIMITS.domNodes ||
      depth > LIMITS.domDepth ||
      fields > LIMITS.fields ||
      outputCharacters >= LIMITS.outputCharacters
    ) {
      truncated = true;
      return;
    }
    if (ignoredElement(node)) return;
    if ('tagName' in node) inspect(node);
    if ('childNodes' in node)
      for (const child of node.childNodes) visit(child, depth + 1);
  }
  visit(root, 0);
  if (truncated)
    lines.push(
      '[Embedded page content truncated at bounded extraction limits; omitted content is unknown.]',
    );
  return lines.join('\n');
}
