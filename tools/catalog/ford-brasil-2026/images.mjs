import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import catalog from './manifest.mjs';
import checkedMetadata from './image-metadata.mjs';
import imageSources from './image-sources.mjs';

const bucket = 'fiap-challenge-ford-specsync-dev-vehicle-images';
const capturedAt = '2026-09-12T12:00:00-03:00';
const rightsNote =
  'Manufacturer-owned image; source attribution retained. No independent reuse license verification or commercial-use permission recorded.';
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;

const configurations = catalog.models.flatMap((model) =>
  model.configurations.map((configuration) => ({
    brand: catalog.brand,
    model: model.name,
    name: configuration.name,
    market: configuration.market,
    modelYear: configuration.modelYear,
  })),
);

function assignments() {
  assert.equal(
    imageSources.length,
    27,
    'Expected 27 unique official Ford image assets',
  );
  const result = configurations.map((configuration) => {
    const candidates = imageSources.filter(
      (source) =>
        source.model === configuration.model &&
        (source.name === undefined || source.name === configuration.name),
    );
    assert.equal(
      candidates.length,
      1,
      `Expected one image for ${configuration.model}/${configuration.name}`,
    );
    return { ...configuration, ...candidates[0] };
  });
  assert.equal(result.length, catalog.expected.configurationCount);
  return result;
}

async function download(directory) {
  mkdirSync(directory, { recursive: true });
  for (const source of imageSources) {
    const response = await fetch(source.sourceUrl, {
      headers: { 'user-agent': 'SpecSync official-source capture/1.0' },
    });
    assert.equal(
      response.status,
      200,
      `${source.file}: HTTP ${response.status}`,
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length > 0, source.file);
    writeFileSync(resolve(directory, source.file), bytes);
    console.error(`${source.file}: ${bytes.length} bytes`);
  }
}

function readMetadata(directory, source) {
  const path = resolve(directory, source.file);
  const bytes = readFileSync(path);
  const [format, width, height] = execFileSync(
    'identify',
    ['-format', '%m %w %h', path],
    { encoding: 'utf8' },
  )
    .trim()
    .split(/\s+/);
  const contentTypes = {
    JPEG: 'image/jpeg',
    PNG: 'image/png',
    WEBP: 'image/webp',
    AVIF: 'image/avif',
  };
  assert.ok(contentTypes[format], `${source.file}: unsupported ${format}`);
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    contentType: contentTypes[format],
    byteSize: bytes.length,
    width: Number(width),
    height: Number(height),
  };
}

function buildManifest(directory) {
  const metadataByFile = new Map(
    imageSources.map((source) => [
      source.file,
      readMetadata(directory, source),
    ]),
  );
  return assignments().map((assignment) => {
    const metadata = metadataByFile.get(assignment.file);
    return {
      ...assignment,
      bucket,
      object: `vehicles/primary/${metadata.sha256}/${assignment.file}`,
      ...metadata,
      altText: `${assignment.brand} ${assignment.model} ${assignment.name} — official manufacturer image`,
      rightsNote,
      capturedAt,
    };
  });
}

function checkedInManifest() {
  assert.equal(checkedMetadata.size, imageSources.length);
  const images = assignments().map((assignment) => {
    const metadata = checkedMetadata.get(assignment.file);
    assert.ok(metadata, assignment.file);
    return {
      ...assignment,
      bucket,
      object: `vehicles/primary/${metadata.sha256}/${assignment.file}`,
      ...metadata,
      altText: `${assignment.brand} ${assignment.model} ${assignment.name} — official manufacturer image`,
      rightsNote,
      capturedAt,
    };
  });
  assert.equal(images.length, catalog.expected.configurationCount);
  return images;
}

function sql() {
  const images = checkedInManifest();
  console.log('BEGIN;');
  for (const image of images) {
    const values = [
      image.bucket,
      image.object,
      image.sha256,
      image.contentType,
      image.byteSize,
      image.width,
      image.height,
      image.altText,
      image.sourceUrl,
      image.sourcePageUrl,
      image.matchScope,
      image.matchNote,
      image.rightsNote,
      image.capturedAt,
    ];
    console.log(`INSERT INTO catalog.vehicle_image (
      configuration_id, storage_bucket, storage_object, sha256, content_type,
      byte_size, width, height, alt_text, source_url, source_page_url,
      match_scope, match_note, rights_note, captured_at
    ) SELECT c.id, ${values.map(literal).join(', ')}
      FROM catalog.vehicle_configuration c
      JOIN catalog.vehicle_model m ON m.id = c.model_id
      JOIN catalog.brand b ON b.id = m.brand_id
      WHERE b.name = ${literal(image.brand)} AND m.name = ${literal(image.model)}
        AND c.name = ${literal(image.name)} AND c.market = ${literal(image.market)}
        AND c.model_year = ${Number(image.modelYear)} AND c.superseded_by IS NULL
      ON CONFLICT (configuration_id) DO UPDATE SET
        storage_bucket = EXCLUDED.storage_bucket,
        storage_object = EXCLUDED.storage_object,
        sha256 = EXCLUDED.sha256,
        content_type = EXCLUDED.content_type,
        byte_size = EXCLUDED.byte_size,
        width = EXCLUDED.width,
        height = EXCLUDED.height,
        alt_text = EXCLUDED.alt_text,
        source_url = EXCLUDED.source_url,
        source_page_url = EXCLUDED.source_page_url,
        match_scope = EXCLUDED.match_scope,
        match_note = EXCLUDED.match_note,
        rights_note = EXCLUDED.rights_note,
        captured_at = EXCLUDED.captured_at;`);
  }
  console.log('COMMIT;');
  console.log(`SELECT json_build_object(
    'configurations', count(DISTINCT c.id),
    'images', count(DISTINCT i.configuration_id),
    'missing', count(DISTINCT c.id) FILTER (WHERE i.configuration_id IS NULL)
  ) FROM catalog.vehicle_configuration c
  JOIN catalog.vehicle_model m ON m.id=c.model_id
  JOIN catalog.brand b ON b.id=m.brand_id
  LEFT JOIN catalog.vehicle_image i ON i.configuration_id=c.id
  WHERE b.name='Ford' AND c.superseded_by IS NULL;`);
}

function upload(directory) {
  const images = checkedInManifest();
  const objects = [
    ...new Map(images.map((image) => [image.object, image])).values(),
  ];
  for (const image of objects) {
    const bytes = readFileSync(resolve(directory, image.file));
    assert.equal(bytes.length, image.byteSize, image.file);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      image.sha256,
      image.file,
    );
  }
  for (const image of objects) {
    execFileSync(
      'gcloud',
      [
        'storage',
        'cp',
        resolve(directory, image.file),
        `gs://${image.bucket}/${image.object}`,
        '--no-clobber',
        `--content-type=${image.contentType}`,
        '--cache-control=public,max-age=31536000,immutable',
        `--custom-metadata=sha256=${image.sha256},catalog=ford-brasil-2026`,
      ],
      { stdio: 'inherit' },
    );
  }
}

async function verifyPublicObjects() {
  const images = checkedInManifest();
  const objects = [
    ...new Map(images.map((image) => [image.object, image])).values(),
  ];
  for (const image of objects) {
    const url = `https://storage.googleapis.com/${image.bucket}/${image.object}`;
    const response = await fetch(url);
    assert.equal(response.status, 200, url);
    assert.equal(response.headers.get('content-type'), image.contentType, url);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, image.byteSize, url);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      image.sha256,
      url,
    );
  }
  console.log(
    JSON.stringify({
      configurations: images.length,
      publicObjects: objects.length,
    }),
  );
}

const [command, directory] = process.argv.slice(2);
if (command === 'download' && directory) await download(directory);
else if (command === 'manifest' && directory)
  console.log(JSON.stringify(buildManifest(directory), null, 2));
else if (command === 'sql') sql();
else if (command === 'upload' && directory) upload(directory);
else if (command === 'verify') await verifyPublicObjects();
else
  throw new Error(
    'Usage: node tools/catalog/ford-brasil-2026/images.mjs download|manifest|upload <directory> | sql | verify',
  );
