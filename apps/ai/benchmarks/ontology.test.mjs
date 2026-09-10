import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import {
  assessOntology,
  loadOntologyDataset,
  loadOntologyRuntime,
  predictOntology,
  scoreOntology,
} from './ontology-eval.mjs';

let dataset, loaded, predictions;
before(async () => {
  dataset = await loadOntologyDataset();
  loaded = await loadOntologyRuntime();
  predictions = predictOntology(dataset, loaded.runtime);
});
after(async () => {
  await loaded?.close();
});

test('the production ontology resolver meets every synthetic gate with zero false merges and preserved novel facts', async () => {
  const result = await scoreOntology(predictions, dataset);
  assert.equal(result.passed, true);
  assert.equal(result.counts.falseMerges, 0);
  assert.equal(result.counts.expectedNovel, 7);
  assert.equal(result.counts.coverageGain, 6);
  assert.ok(
    Object.keys(loaded.sourceHashes).includes(
      'apps/ai/src/mastra/ingestion/ontology.ts',
    ),
  );
  assert.ok(
    Object.keys(loaded.sourceHashes).includes(
      'apps/ai/src/mastra/ingestion/extraction.ts',
    ),
  );
});

const mutated = (id, mutate) => {
  const value = structuredClone(predictions);
  mutate(value.find((item) => item.id === id));
  return assessOntology(value, dataset);
};

test('zero false merges rejects payload/towing, bed/luggage, passenger-count and hybrid/fuel confusion', () => {
  for (const [id, wrongCode] of [
    ['towing_black', 'payload'],
    ['bed_volume', 'luggage_volume'],
    ['driver_semantics', 'passenger_capacity'],
    ['hybrid_not_fuel', 'fuel_type'],
    ['package_not_feature', 'locking_differential'],
  ]) {
    const result = mutated(id, (item) => {
      item.afterAttributeCode = wrongCode;
    });
    assert.equal(result.metrics.zeroFalseMerges, 0, id);
    assert.equal(result.counts.falseMerges, 1, id);
  }
});

test('scoped term leaks into another brand/model/year fail even with a correct-looking number', () => {
  for (const id of ['other_brand', 'other_model', 'other_year']) {
    assert.equal(
      mutated(id, (item) => {
        item.afterAttributeCode = 'towing_capacity';
      }).metrics.zeroFalseMerges,
      0,
    );
  }
  assert.equal(
    predictions.find(({ id }) => id === 'f150_alias').afterAttributeCode,
    'towing_capacity',
  );
});

test('wrong trim, raw number, unit, and unknown conditions fail their independent gates', () => {
  assert.equal(
    mutated('towing_black', (item) => {
      item.observation.configuration = 'Tremor';
    }).metrics.configurationValueAccuracy,
    14 / 15,
  );
  assert.equal(
    mutated('towing_black', (item) => {
      item.observation.rawValue = '3.945';
    }).metrics.configurationValueAccuracy,
    14 / 15,
  );
  assert.equal(
    mutated('bed_volume', (item) => {
      item.observation.sourceUnit = 'kg';
    }).metrics.configurationValueAccuracy,
    14 / 15,
  );
  for (const [id, qualifiers] of [
    ['towing_black', { brakingCondition: 'BRAKED' }],
    ['passengers', { driverIncluded: 'TRUE' }],
    ['fuel_combination', {}],
  ])
    assert.equal(
      mutated(id, (item) => {
        item.observation.qualifiers = qualifiers;
      }).metrics.qualifierAccuracy,
      14 / 15,
    );
});

test('missed novel concepts, forged source evidence, duplicate cases and missing replay gains cannot pass', () => {
  assert.notEqual(
    mutated('novel_concept', (item) => {
      item.observation = null;
    }).metrics.novelConceptRetention,
    1,
  );
  assert.notEqual(
    mutated('towing_black', (item) => {
      item.observation.excerpt = 'Invented evidence';
    }).metrics.evidenceValidity,
    1,
  );
  assert.notEqual(
    mutated('towing_black', (item) => {
      item.afterAttributeCode = null;
    }).metrics.coverageGain,
    1,
  );
  assert.equal(
    assessOntology([...predictions, predictions[0]], dataset).metrics
      .uniqueCompleteCases,
    0,
  );
  const badSource = structuredClone(dataset);
  badSource.cases[0].text += ' altered';
  assert.throws(
    () => predictOntology(badSource, loaded.runtime),
    /Source digest mismatch/,
  );
});
