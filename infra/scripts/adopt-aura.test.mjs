import assert from 'node:assert/strict';
import { test } from 'node:test';

import { repairImportedState } from './adopt-aura.mjs';

const state = () => ({
  serial: 42,
  lineage: 'existing-lineage',
  resources: [
    {
      module: 'module.database',
      type: 'random_password',
      instances: [{ attributes: { result: 'retained' } }],
    },
    {
      module: 'module.neo4j_aura',
      mode: 'managed',
      type: 'neo4jaura_instance',
      name: 'this',
      instances: [
        {
          attributes: {
            instance_id: 'instance',
            project_id: null,
            version: null,
            name: 'Existing DB',
          },
        },
      ],
    },
  ],
});

test('repairs only missing metadata, advances serial once and preserves lineage and other resources', () => {
  const original = state();
  const repaired = repairImportedState(original, 'instance', 'project');
  const expected = state();
  expected.serial += 1;
  expected.resources[1].instances[0].attributes.project_id = 'project';
  expected.resources[1].instances[0].attributes.version = '5';
  assert.deepEqual(repaired, expected);
  assert.deepEqual(original, state());
  assert.deepEqual(
    repairImportedState(repaired, 'instance', 'project'),
    repaired,
  );
});

test('rejects a different instance or an existing conflicting project/version', () => {
  assert.throws(
    () => repairImportedState(state(), 'different', 'project'),
    /different Aura instance/,
  );
  for (const field of ['project_id', 'version']) {
    const conflicting = state();
    conflicting.resources[1].instances[0].attributes[field] = 'conflict';
    assert.throws(
      () => repairImportedState(conflicting, 'instance', 'project'),
      /refusing to overwrite/,
    );
  }
});

test('rejects absent or ambiguous instances', () => {
  assert.throws(
    () => repairImportedState({ resources: [] }, 'instance', 'project'),
    /exactly one/,
  );
  const ambiguous = state();
  ambiguous.resources[1].instances.push(
    structuredClone(ambiguous.resources[1].instances[0]),
  );
  assert.throws(
    () => repairImportedState(ambiguous, 'instance', 'project'),
    /exactly one/,
  );
});
