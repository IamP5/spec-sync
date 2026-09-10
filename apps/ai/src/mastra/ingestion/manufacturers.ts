/** Explicitly supported official hosts; deployments can replace this policy. */
const manufacturers = [
  {
    domain: 'ford.com.br',
    aliases: ['ford'],
    paths: [
      '/picapes/{model}/',
      '/suvs/{model}/',
      '/carros/{model}/',
      '/utilitarios/{model}/',
    ],
  },
  { domain: 'toyota.com.br', aliases: ['toyota'], paths: ['/modelos/{model}'] },
  {
    domain: 'nissan.com.br',
    aliases: ['nissan'],
    paths: [
      '/veiculos/modelos/{model}.html',
      '/veiculos/modelos/novo-{model}.html',
      '/veiculos/modelos/nova-{model}.html',
    ],
  },
  {
    domain: 'ram.com.br',
    aliases: ['ram', 'ram-trucks', 'dodge-ram'],
    paths: ['/{model}.html', '/picapes/{model}.html'],
  },
];

export const DEFAULT_MANUFACTURER_DOMAINS = manufacturers.map(
  ({ domain }) => domain,
);

export function canonicalScope(
  brand: string,
  model: string,
  modelYear: number,
) {
  const entry = manufacturers.find(({ aliases }) =>
    aliases.includes(slugOf(brand)),
  );
  const canonicalBrand = entry
    ? ({
        'ford.com.br': 'Ford',
        'toyota.com.br': 'Toyota',
        'nissan.com.br': 'Nissan',
        'ram.com.br': 'RAM',
      }[entry.domain] ?? brand)
    : brand;
  let canonicalModel = model.trim();
  if (entry?.domain === 'ford.com.br' && /^f-?\d{3}$/i.test(slugOf(model)))
    canonicalModel = slugOf(model).replace(/^f-?/, 'F-');
  if (entry?.domain === 'ram.com.br' && /^ram[- ]?\d/i.test(canonicalModel))
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

/** Aliases select only hosts that the deployment already approves. */
export function manufacturerDomains(
  brand: string,
  domains: string[],
): string[] {
  const slug = slugOf(brand);
  const entry = manufacturers.find(({ aliases }) => aliases.includes(slug));
  return domains.filter((domain) =>
    entry
      ? domain === entry.domain || domain.endsWith(`.${entry.domain}`)
      : domain.split('.')[0] === slug,
  );
}

export function modelSlugs(model: string, brand = ''): string[] {
  let slug = slugOf(model);
  const brandSlug = slugOf(brand);
  const entry = manufacturers.find(({ aliases }) =>
    aliases.includes(brandSlug),
  );
  const prefix = entry?.aliases[0] ?? brandSlug;
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

export function modelPathTemplates(domain: string): string[] {
  return (
    manufacturers.find(
      (entry) => domain === entry.domain || domain.endsWith(`.${entry.domain}`),
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
