import { expect, it } from 'vitest';

import { configurationSchema } from './contracts';

const vehicle = {
  id: 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
  brand: 'Ford',
  model: 'Ranger',
  name: 'Limited',
  market: 'BR',
  modelYear: 2026,
  identityStatus: 'PROVISIONAL',
  identityNote: null,
  identityEvidenceId: null,
};
const image = {
  url: `https://storage.googleapis.com/specsync-dev-vehicle-images/vehicles/primary/${'a'.repeat(64)}/ranger.jpg`,
  sha256: 'a'.repeat(64),
  width: 1280,
  height: 509,
  altText: 'Ford Ranger',
  matchScope: 'ILLUSTRATIVE',
  sourcePageUrl: 'https://www.ford.com.br/',
};

it('preserves public image metadata and accepts historic results without images', () => {
  expect(
    configurationSchema.parse({ ...vehicle, primaryImage: image }).primaryImage,
  ).toEqual(image);
  expect(configurationSchema.parse(vehicle).primaryImage).toBeUndefined();
  expect(
    configurationSchema.parse({ ...vehicle, primaryImage: null }).primaryImage,
  ).toBeNull();
});

it('rejects invalid image metadata', () => {
  for (const primaryImage of [
    { ...image, url: 'https://example.com/image.jpg' },
    { ...image, url: image.url.replace('-vehicle-images/', '-files/') },
    { ...image, width: 0 },
  ]) {
    expect(
      configurationSchema.safeParse({ ...vehicle, primaryImage }).success,
    ).toBe(false);
  }
});
