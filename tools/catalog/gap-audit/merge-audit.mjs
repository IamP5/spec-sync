// Merges a generated gap-audit module (apply-audit.mjs) into a dataset
// manifest: new source revisions, attribute definitions, and the accepted
// specifications appended to their configurations. Every audit specification
// must land on exactly one configuration; anything else is a stale module.
import assert from 'node:assert/strict';

export function auditSources(audit) {
  return audit.sources.map((source) => ({
    key: source.key,
    title: source.title,
    path: new URL(source.url).pathname,
    sha256: source.sha256,
    provenance: 'PRIMARY_SOURCE',
    upstreamUrls: [source.url],
    capturedOn: source.capturedOn,
    publishedOn: null,
  }));
}

// entries: [{ brand, model }] where model is a manifest model object.
export function appendAuditSpecifications(audit, entries) {
  const configurations = new Map();
  for (const { brand, model } of entries)
    for (const configuration of model.configurations)
      configurations.set(
        `${brand}|${model.name}|${configuration.name}|${configuration.modelYear}`,
        configuration,
      );
  for (const item of audit.specifications) {
    const key = `${item.brand}|${item.model}|${item.name}|${item.modelYear}`;
    const configuration = configurations.get(key);
    assert.ok(
      configuration,
      `gap audit ${audit.stamp}: no configuration ${key}`,
    );
    configuration.specifications.push(item.specification);
  }
}
