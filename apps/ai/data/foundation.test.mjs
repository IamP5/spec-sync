import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  fixtureRoot,
  loadDataset,
  projectionStatements,
  seedSql,
  sqlLiteral,
  validateDataset,
} from './foundation.mjs';

const { dataset, digest } = await loadDataset();
const t = dataset.tables;
const documents = Object.fromEntries(
  await Promise.all(
    t.source_revision.map(async (s) => [
      s.path,
      await readFile(resolve(fixtureRoot, s.path), 'utf8'),
    ]),
  ),
);
const cell = (name, code) => {
  const c = t.vehicle_configuration.find((r) => r.name.startsWith(name));
  const d = t.attribute_definition.find((r) => r.code === code);
  const accepted = t.accepted_specification.find(
    (r) => r.configuration_id === c.id && r.attribute_id === d.id,
  );
  return {
    accepted,
    assertion: t.spec_assertion.find((r) => r.id === accepted.assertion_id),
  };
};

test('every fixture observation has exact, checksum-verified evidence', () => {
  validateDataset(dataset, documents);
  assert.equal(t.vehicle_configuration.length, 5);
  assert.equal(t.source_revision.length, 3);
  assert.equal(t.spec_assertion.length, 76);
});

test('rejects source edits and mismatched evidence instead of silently changing provenance', () => {
  assert.throws(
    () =>
      validateDataset(dataset, {
        ...documents,
        'sources/ranger-specs.md': 'changed',
      }),
    /checksum/,
  );
  const edited = structuredClone(dataset);
  edited.tables.evidence[0].excerpt = 'invented evidence';
  assert.throws(
    () => validateDataset(edited, documents),
    /Evidence does not match/,
  );
});

test('converts torque while preserving engine speed range and source units', () => {
  const frontier = cell('PRO-4X', 'torque_max').assertion;
  assert.equal(frontier.value, 450.125235);
  assert.equal(frontier.qualifiers.source_value, 45.9);
  assert.equal(frontier.qualifiers.source_unit, 'kgf.m');
  assert.equal(frontier.qualifiers.engine_speed_rpm_min, 1500);
  assert.equal(frontier.qualifiers.engine_speed_rpm_max, 2500);
  assert.equal(cell('SRX Plus', 'torque_max').assertion.value, 499.158485);
});

test('does not propagate PRO-4X-only dimensions to Platinum or infer mirror scope', () => {
  assert.equal(cell('PRO-4X', 'height').assertion.value, 1857);
  assert.equal(
    cell('Platinum', 'height').accepted.knowledge_status,
    'NOT_REPORTED',
  );
  assert.equal(cell('PRO-4X', 'width_unspecified').assertion.value, 1875);
  assert.equal(
    cell('PRO-4X', 'width_without_mirrors').accepted.knowledge_status,
    'NOT_REPORTED',
  );
});

test('retains both Black drivetrain observations and selects neither', () => {
  const { accepted } = cell('Black', 'drivetrain');
  assert.equal(accepted.knowledge_status, 'CONFLICTING');
  assert.equal(accepted.assertion_id, null);
  assert.deepEqual(
    t.spec_assertion
      .filter(
        (r) =>
          r.configuration_id === accepted.configuration_id &&
          r.attribute_id === accepted.attribute_id,
      )
      .map((r) => r.value)
      .sort(),
    ['4x2', '4x4'],
  );
  assert.equal(
    t.vehicle_configuration.find((r) => r.name.startsWith('Black'))
      .identity_status,
    'PROVISIONAL',
  );
});

test('distinguishes known absence, unknown availability, and optional package items', () => {
  assert.equal(cell('PRO-4X', 'sunroof').assertion.availability, 'ABSENT');
  assert.equal(cell('Platinum', 'sunroof').assertion.availability, 'STANDARD');
  assert.equal(
    cell('Platinum', 'adaptive_cruise').accepted.knowledge_status,
    'NOT_REPORTED',
  );
  assert.equal(
    cell('Limited', 'adaptive_cruise').assertion.availability,
    'OPTIONAL',
  );
  assert.equal(t.configuration_package[0].availability, 'OPTIONAL');
  assert.equal(
    cell('SRX Plus', 'drivetrain').accepted.knowledge_status,
    'NOT_REPORTED',
  );
});

test('keeps undated prices identifiable as historical source claims', () => {
  for (const name of ['Limited', 'Black', 'Platinum', 'PRO-4X']) {
    const { qualifiers } = cell(name, 'reference_price').assertion;
    assert.equal(qualifiers.effective_on, null);
    assert.equal(qualifiers.current_price_verified, false);
  }
});

test('does not resolve the Hilux camera contradiction by silently preferring a source section', () => {
  const { accepted } = cell('SRX Plus', 'camera_360');
  assert.equal(accepted.knowledge_status, 'CONFLICTING');
  assert.equal(accepted.assertion_id, null);
  const observations = t.spec_assertion.filter(
    (a) =>
      a.configuration_id === accepted.configuration_id &&
      a.attribute_id === accepted.attribute_id,
  );
  assert.deepEqual(observations.map((a) => a.availability).sort(), [
    'ABSENT',
    'STANDARD',
  ]);
});

test('rejects cross-configuration acceptance and incorrect attribute types', () => {
  const edited = structuredClone(dataset);
  const accepted = edited.tables.accepted_specification.find(
    (r) => r.knowledge_status === 'KNOWN',
  );
  accepted.assertion_id = edited.tables.spec_assertion.find(
    (r) => r.configuration_id !== accepted.configuration_id,
  ).id;
  assert.throws(
    () => validateDataset(edited, documents),
    /another configuration/,
  );
  const wrongType = structuredClone(dataset);
  wrongType.tables.spec_assertion[0].value_type = 'NUMBER';
  assert.throws(() => validateDataset(wrongType, documents), /type differs/);
});

test('seed SQL safely contains quotes, backslashes and PL/pgSQL delimiter-like source text', () => {
  assert.equal(sqlLiteral("it's \\ literal"), "'it''s \\ literal'");
  assert.throws(() => sqlLiteral('\0'), /null byte/);
  const edited = structuredClone(dataset);
  edited.tables.evidence[0].excerpt = "' $seed$ \\ ${untrusted} `text`";
  const sql = seedSql(edited, digest);
  assert.match(sql, /DO \$seed_\$/);
  assert.match(sql, /standard_conforming_strings = on/);
});

test('graph projection parameterizes source content and includes selected facts separately', () => {
  const statements = projectionStatements(
    { ...t, seed_dataset: [{ version: dataset.version }] },
    digest,
  );
  assert.equal(
    statements[0].statement,
    'MATCH (p:SpecSyncReview:ReviewProjection) DELETE p',
  );
  assert.equal(
    statements[1].statement,
    'MATCH (n:SpecSyncCatalog) DETACH DELETE n',
  );
  assert(statements.some((s) => s.statement.includes('SELECTS')));
  const nodes = statements.find((s) =>
    s.statement.includes('CREATE (n:SpecSyncCatalog:SpecAssertion)'),
  );
  assert.equal(nodes.parameters.rows.length, t.spec_assertion.length);
  assert.equal(
    JSON.parse(nodes.parameters.rows[0].value_json),
    t.spec_assertion[0].value,
  );
  for (const s of statements)
    assert(!s.statement.includes(t.evidence[0].excerpt));
});
