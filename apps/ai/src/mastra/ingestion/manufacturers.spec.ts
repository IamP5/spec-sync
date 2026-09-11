import { afterEach, expect, it, vi } from 'vitest';

import { OFFICIAL_MANUFACTURERS } from './manufacturer-registry';
import {
  canonicalScope,
  DEFAULT_MANUFACTURER_DOMAINS,
  manufacturerDomains,
  manufacturerSiteDomains,
  officialSiteRoot,
} from './manufacturers';
import { sourceDomains, validateSourceUrl } from './source';

afterEach(() => vi.unstubAllEnvs());

it('admits the official Brazilian BYD model page and technical PDF', () => {
  expect(manufacturerDomains('BYD', sourceDomains())).toContain('byd.com');
  for (const url of [
    'https://www.byd.com/br/car/shark',
    'https://www.byd.com/content/dam/byd-site/br/product/shark/ficha-tecnica/Ficha_Tecnica_Shark_Update_15.10.pdf',
  ])
    expect(validateSourceUrl(url).hostname).toBe('www.byd.com');
  expect(officialSiteRoot('byd.com')).toBe('https://www.byd.com/br');
});

it('resolves market names to their own sites without borrowing another manufacturer domain', () => {
  expect(manufacturerDomains('Great Wall', sourceDomains())).toContain(
    'gwmmotors.com.br',
  );
  expect(manufacturerDomains('Haval', sourceDomains())).toContain(
    'gwmmotors.com.br',
  );
  expect(manufacturerDomains('Chery', sourceDomains())).toContain(
    'caoachery.com.br',
  );
  expect(manufacturerDomains('Geely', sourceDomains())).toContain(
    'geelybrasil.com.br',
  );
  expect(manufacturerDomains('BYD', sourceDomains())).not.toContain(
    'ford.com.br',
  );
  expect(canonicalScope('byd', 'Shark', 2024)).toEqual({
    brand: 'BYD',
    model: 'Shark',
    modelYear: 2024,
    market: 'BR',
  });
});

it('uses deployment overrides as search hints without blocking other sources', () => {
  vi.stubEnv('SPECSYNC_INGESTION_SOURCE_DOMAINS', 'ford.com.br');
  expect(manufacturerDomains('BYD', sourceDomains())).toEqual([]);
  expect(() =>
    validateSourceUrl('https://www.byd.com/br/car/shark'),
  ).not.toThrow();
  expect(manufacturerDomains('Ford', sourceDomains())).toEqual(['ford.com.br']);
  vi.stubEnv('SPECSYNC_INGESTION_SOURCE_DOMAINS', 'www.byd.com');
  expect(manufacturerDomains('BYD', sourceDomains())).toEqual(['www.byd.com']);
});

it('allows secondary websites and shared document hosting without enrolling their URLs', () => {
  for (const url of [
    'https://www.webmotors.com.br/catalogo/byd/shark',
    'https://static.autoforce.com/plugins/files/clientes/geely-brasil/produtos/ws/ficha-tecnica-geely-ex5-v2.pdf',
    'https://documents.example.org/vehicle.pdf',
    'https://unknown-bucket.s3.amazonaws.com/specifications.pdf',
  ])
    expect(() => validateSourceUrl(url)).not.toThrow();
});

it('keeps documented official entry points reachable by the policy and document CDNs out of crawl roots', () => {
  const aliases = new Set<string>();
  for (const entry of OFFICIAL_MANUFACTURERS) {
    for (const alias of [entry.name, ...entry.aliases]) {
      const key = alias.toLowerCase();
      expect(aliases.has(key), `Ambiguous manufacturer alias: ${alias}`).toBe(
        false,
      );
      aliases.add(key);
      expect(
        manufacturerDomains(alias, DEFAULT_MANUFACTURER_DOMAINS).length,
      ).toBeGreaterThan(0);
      for (const site of entry.sites)
        expect(() => validateSourceUrl(site.url)).not.toThrow();
    }
    for (const host of entry.documentDomains ?? []) {
      expect(
        manufacturerDomains(entry.name, DEFAULT_MANUFACTURER_DOMAINS),
      ).toContain(host);
      expect(
        manufacturerSiteDomains(entry.name, DEFAULT_MANUFACTURER_DOMAINS),
      ).not.toContain(host);
    }
  }
});
