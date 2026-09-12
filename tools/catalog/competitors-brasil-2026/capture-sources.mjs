import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

import sources from './source-sources.mjs';

const directory = process.argv[2];
if (!directory) {
  throw new Error('Usage: node capture-sources.mjs <capture-directory>');
}

mkdirSync(directory, { recursive: true });
const metadata = [];
for (const source of sources) {
  const response = await fetch(source.url, {
    headers: {
      accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8',
      'accept-language': 'pt-BR,pt;q=0.9',
      referer: `${new URL(source.url).origin}/`,
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36',
    },
    redirect: 'follow',
  });
  assert.equal(response.status, 200, `${source.key}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length > 0, source.key);
  const contentType = response.headers.get('content-type') ?? '';
  const extension = contentType.includes('pdf')
    ? '.pdf'
    : extname(new URL(response.url).pathname) || '.html';
  const file = `${source.key}${extension === '.html' ? extension : extension.toLowerCase()}`;
  writeFileSync(resolve(directory, file), bytes);
  metadata.push([
    source.key,
    {
      sha256: createHash('sha256').update(bytes).digest('hex'),
      byteSize: bytes.length,
      contentType,
      finalUrl: response.url,
      file,
    },
  ]);
  console.error(`${source.key}: ${bytes.length} bytes`);
}

console.log(`export default new Map(${JSON.stringify(metadata, null, 2)});`);
