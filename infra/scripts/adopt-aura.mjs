import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const address = 'module.neo4j_aura.neo4jaura_instance.this';

function resourceIn(state) {
  return state.resources?.find(
    (resource) =>
      resource.module === 'module.neo4j_aura' &&
      resource.mode === 'managed' &&
      resource.type === 'neo4jaura_instance' &&
      resource.name === 'this',
  );
}

// Provider 1.1.0 imports the ID but omits project_id and its creation-version
// selector. Its default version then forces replacement, even with ignore_changes.
export function repairImportedState(state, instanceId, projectId) {
  const repaired = structuredClone(state);
  const resource = resourceIn(repaired);
  if (resource?.instances?.length !== 1) {
    throw new Error('Expected exactly one imported Aura instance in state.');
  }
  const attributes = resource.instances[0].attributes;
  if (attributes.instance_id !== instanceId) {
    throw new Error(
      'Terraform manages a different Aura instance; refusing to change state.',
    );
  }
  let changed = false;
  for (const [key, value] of Object.entries({
    project_id: projectId,
    version: '5',
  })) {
    if (attributes[key] != null && attributes[key] !== value) {
      throw new Error(`Existing ${key} differs; refusing to overwrite it.`);
    }
    changed ||= attributes[key] !== value;
    attributes[key] = value;
  }
  if (changed) {
    if (!Number.isSafeInteger(repaired.serial))
      throw new Error('Invalid Terraform state serial.');
    repaired.serial += 1;
  }
  return repaired;
}

async function main() {
  const required = (name) => {
    if (!process.env[name]) throw new Error(`Missing ${name}.`);
    return process.env[name];
  };
  const instanceId = required('AURA_INSTANCE_ID');
  const projectId = required('AURA_PROJECT_ID');
  if (!/^[a-z0-9]+$/i.test(instanceId))
    throw new Error('Invalid Aura instance ID.');
  const credentials = `${required('AURA_CLIENT_ID')}:${required('AURA_CLIENT_SECRET')}`;
  const tokenResponse = await fetch('https://api.neo4j.io/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(30000),
  });
  if (!tokenResponse.ok)
    throw new Error(`Aura authentication failed (${tokenResponse.status}).`);
  const token = await tokenResponse.json();
  const instanceResponse = await fetch(
    `https://api.neo4j.io/v1/instances/${instanceId}`,
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!instanceResponse.ok)
    throw new Error(`Aura lookup failed (${instanceResponse.status}).`);
  const { data } = await instanceResponse.json();
  if (
    data.id !== instanceId ||
    data.tenant_id !== projectId ||
    data.cloud_provider !== 'gcp'
  ) {
    throw new Error(
      'Aura instance does not match the expected GCP instance and Aura project.',
    );
  }

  const lock = readFileSync('.terraform.lock.hcl', 'utf8');
  if (
    !/provider "registry\.terraform\.io\/neo4j-labs\/neo4jaura"\s*\{\s*version\s*=\s*"1\.1\.0"/.test(
      lock,
    )
  ) {
    throw new Error(
      'This import workaround is only reviewed for provider 1.1.0.',
    );
  }
  // Capture output because Terraform state contains secrets from other modules.
  const terraform = (...args) =>
    execFileSync('terraform', args, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  const before = terraform('state', 'pull');
  const backup = mkdtempSync(join(tmpdir(), 'specsync-aura-import-'));
  writeFileSync(join(backup, 'before.tfstate'), before, { mode: 0o600 });
  console.log(`Terraform state backup: ${backup}`);
  if (!resourceIn(JSON.parse(before))) {
    terraform('import', '-input=false', address, instanceId);
  }
  const imported = terraform('state', 'pull');
  writeFileSync(join(backup, 'imported.tfstate'), imported, { mode: 0o600 });
  const state = JSON.parse(imported);
  const repaired = repairImportedState(state, instanceId, projectId);
  if (JSON.stringify(state) !== JSON.stringify(repaired)) {
    const path = join(backup, 'repaired.tfstate');
    writeFileSync(path, JSON.stringify(repaired), { mode: 0o600 });
    // Advance the serial once, retaining lineage. Push locks and rejects newer
    // remote state or a different snapshot with the same serial. Never use -force.
    terraform('state', 'push', path);
  }
  console.log(
    `Adopted Aura instance ${instanceId}. Run infra:plan to review infrastructure changes.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    // A child-process error can contain an entire state payload: never print it.
    console.error(
      error.status == null
        ? error.message
        : `Terraform command failed (exit ${error.status}); state backup retained.`,
    );
    process.exitCode = 1;
  });
}
