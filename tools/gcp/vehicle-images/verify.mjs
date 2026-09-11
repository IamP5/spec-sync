import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const origin = process.env.API_BASE_URL ?? 'http://localhost:8080';
const expectedCount = process.env.EXPECTED_VEHICLES;
const headers = {};
if (process.env.CLOUD_RUN_IDENTITY === 'true') {
  const identity = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=' +
      encodeURIComponent(origin),
    { headers: { 'Metadata-Flavor': 'Google' } },
  );
  assert.equal(identity.status, 200, 'Cloud Run identity');
  headers.Authorization = `Bearer ${await identity.text()}`;
}
async function read(path) {
  const response = await fetch(new URL(path, origin), { headers });
  assert.equal(response.status, 200, path);
  return response.json();
}
const page = await read('/api/vehicle-configurations?limit=100');
assert.ok(page.items.length > 0, 'Catalog is empty');
assert.equal(page.hasMore, false, 'Verification needs the complete catalog');
if (expectedCount) assert.equal(page.items.length, Number(expectedCount));
for (const vehicle of page.items) {
  const image = vehicle.primaryImage;
  assert.ok(image, `Missing image: ${vehicle.id}`);
  assert.match(
    image.url,
    /^https:\/\/storage\.googleapis\.com\/[^/]+-vehicle-images\/vehicles\/primary\//,
  );
  const response = await fetch(image.url);
  assert.equal(response.status, 200, image.url);
  assert.match(response.headers.get('content-type') ?? '', /^image\//);
  assert.equal(
    createHash('sha256')
      .update(Buffer.from(await response.arrayBuffer()))
      .digest('hex'),
    image.sha256,
  );
  const detail = await read(
    `/api/vehicle-specifications?configurationId=${vehicle.id}`,
  );
  assert.deepEqual(detail.configurations[0].primaryImage, image);
}
if (page.items.length >= 2) {
  const pair = page.items.slice(0, 2);
  const comparison = await read(
    `/api/comparisons?configurationIds=${pair.map((v) => v.id).join(',')}`,
  );
  assert.deepEqual(
    comparison.configurations.map((v) => v.primaryImage),
    pair.map((v) => v.primaryImage),
  );
}
console.log(
  JSON.stringify({
    vehicles: page.items.length,
    publicImages: page.items.length,
    search: 'passed',
    specifications: 'passed',
    comparison: 'passed',
  }),
);
