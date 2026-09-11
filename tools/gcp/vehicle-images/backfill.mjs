import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest = JSON.parse(
  readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'),
);
const [command, directory] = process.argv.slice(2);
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;

if (command === 'sql') {
  console.log('BEGIN;');
  for (const image of manifest) {
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
    // Match identity as well as UUID; absent configurations are never created.
    // Existing primary images are preserved on reruns.
    console.log(`INSERT INTO catalog.vehicle_image (
      configuration_id, storage_bucket, storage_object, sha256, content_type,
      byte_size, width, height, alt_text, source_url, source_page_url,
      match_scope, match_note, rights_note, captured_at
    ) SELECT c.id, ${values.map(literal).join(', ')}
      FROM catalog.vehicle_configuration c
      JOIN catalog.vehicle_model m ON m.id = c.model_id
      JOIN catalog.brand b ON b.id = m.brand_id
      WHERE c.id = ${literal(image.configurationId)}::uuid
        AND b.name = ${literal(image.brand)} AND m.name = ${literal(image.model)}
        AND c.name = ${literal(image.name)} AND c.market = ${literal(image.market)}
        AND c.model_year = ${Number(image.modelYear)}
      ON CONFLICT (configuration_id) DO NOTHING;`);
  }
  console.log('COMMIT;');
  console.log(`SELECT json_build_object(
    'configurations', (SELECT count(*) FROM catalog.vehicle_configuration),
    'images', (SELECT count(*) FROM catalog.vehicle_image),
    'missing', (SELECT count(*) FROM catalog.vehicle_configuration c
      LEFT JOIN catalog.vehicle_image i ON i.configuration_id = c.id
      WHERE i.configuration_id IS NULL)
  );`);
} else if (command === 'relocate') {
  console.log('BEGIN;');
  for (const image of manifest) {
    // Relocate only the exact previously imported bytes, preserving replacements.
    console.log(`UPDATE catalog.vehicle_image
      SET storage_bucket = ${literal(image.bucket)}
      WHERE configuration_id = ${literal(image.configurationId)}::uuid
        AND sha256 = ${literal(image.sha256)}
        AND storage_object = ${literal(image.object)}
        AND storage_bucket = 'fiap-challenge-ford-specsync-dev-files';`);
  }
  console.log('COMMIT;');
} else if (command === 'upload' && directory) {
  // Validate the complete batch before making any remote writes.
  for (const image of manifest) {
    const bytes = readFileSync(resolve(directory, image.file));
    if (
      bytes.length !== image.byteSize ||
      createHash('sha256').update(bytes).digest('hex') !== image.sha256
    ) {
      throw new Error(`Image checksum mismatch: ${image.file}`);
    }
  }
  for (const image of manifest) {
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
        `--custom-metadata=sha256=${image.sha256},configuration-id=${image.configurationId}`,
      ],
      { stdio: 'inherit' },
    );
  }
} else {
  throw new Error(
    'Usage: node backfill.mjs sql | relocate | upload <image-directory>',
  );
}
