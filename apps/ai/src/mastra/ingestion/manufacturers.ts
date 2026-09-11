import { OFFICIAL_MANUFACTURERS } from './manufacturer-registry';

/** Preferred official discovery seeds; these never restrict downloads. */
export const DEFAULT_MANUFACTURER_DOMAINS = [
  ...new Set(
    OFFICIAL_MANUFACTURERS.flatMap((entry) => [
      ...entry.sites.map((site) => domainOf(site.url)),
      ...(entry.documentDomains ?? []),
    ]),
  ),
];

function domainOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

function manufacturer(brand: string) {
  const slug = slugOf(brand);
  return OFFICIAL_MANUFACTURERS.find((entry) =>
    [entry.name, ...entry.aliases].some((alias) => slugOf(alias) === slug),
  );
}

function matchingDomains(preferred: string[], official: string[]): string[] {
  return preferred.filter((domain) =>
    official.some((host) => domain === host || domain.endsWith(`.${host}`)),
  );
}

export function canonicalScope(
  brand: string,
  model: string,
  modelYear: number,
) {
  const entry = manufacturer(brand);
  const canonicalBrand = entry?.name ?? brand;
  let canonicalModel = model.trim();
  if (entry?.name === 'Ford' && /^f-?\d{3}$/i.test(slugOf(model)))
    canonicalModel = slugOf(model).replace(/^f-?/, 'F-');
  if (entry?.name === 'RAM' && /^ram[- ]?\d/i.test(canonicalModel))
    canonicalModel = canonicalModel.replace(/^ram[- ]?/i, '').trim();
  return {
    brand: canonicalBrand,
    model: canonicalModel,
    modelYear,
    market: 'BR' as const,
  };
}

export function slugOf(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Resolve manufacturer aliases to the preferred website hints for this deployment. */
export function manufacturerDomains(
  brand: string,
  domains: string[],
): string[] {
  const entry = manufacturer(brand);
  return entry
    ? matchingDomains(domains, [
        ...entry.sites.map((site) => domainOf(site.url)),
        ...(entry.documentDomains ?? []),
      ])
    : domains.filter((domain) => domain.split('.')[0] === slugOf(brand));
}

/** Document CDNs are download targets, never website/sitemap crawl roots. */
export function manufacturerSiteDomains(
  brand: string,
  domains: string[],
): string[] {
  const entry = manufacturer(brand);
  return entry
    ? matchingDomains(
        domains,
        entry.sites.map((site) => domainOf(site.url)),
      )
    : manufacturerDomains(brand, domains);
}

/** Preserve the official hostname and Brazil landing path from the researched registry. */
export function officialSiteRoot(domain: string): string {
  const site = OFFICIAL_MANUFACTURERS.flatMap((entry) => entry.sites).find(
    (site) =>
      domainOf(site.url) === domain || new URL(site.url).hostname === domain,
  );
  return site?.url ?? `https://www.${domain.replace(/^www\./, '')}/`;
}

export function modelSlugs(model: string, brand = ''): string[] {
  let slug = slugOf(model);
  const brandSlug = slugOf(brand);
  const entry = manufacturer(brand);
  const prefix = slugOf(entry?.name ?? brandSlug);
  if (
    prefix &&
    slug.startsWith(prefix) &&
    /^(-|\d)/.test(slug.slice(prefix.length))
  )
    slug = slug.slice(prefix.length).replace(/^-/, '');
  const aliases = [slug];
  // Manufacturers use both spellings in paths (F150 and F-150).
  if (/^f-?\d{3}$/.test(slug))
    aliases.push(slug.replace(/^f-?/, 'f-'), slug.replace('-', ''));
  return [...new Set(aliases)].filter(Boolean);
}

export function modelPathTemplates(domain: string): readonly string[] {
  return (
    OFFICIAL_MANUFACTURERS.flatMap((entry) => entry.sites).find(
      (site) =>
        domainOf(site.url) === domain ||
        domain.endsWith(`.${domainOf(site.url)}`),
    )?.paths ?? []
  );
}

/** A lexical clue for ranking, never proof of vehicle or model-year applicability. */
export function mentionsModel(
  text: string,
  model: string,
  brand = '',
): boolean {
  const normalized = slugOf(text);
  return modelSlugs(model, brand).some((slug) => {
    const tokens = slug.match(/[a-z]+|\d+/g) ?? [];
    return (
      tokens.length > 0 &&
      new RegExp(`(?:^|-)${tokens.join('-?')}(?:-|$)`).test(normalized)
    );
  });
}
