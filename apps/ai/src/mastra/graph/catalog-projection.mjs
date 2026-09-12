export function projectionStatements(snapshot, fingerprint) {
  const activeConfigurations = snapshot.vehicle_configuration.filter(
    (configuration) => configuration.superseded_by == null,
  );
  const activeConfigurationIds = new Set(
    activeConfigurations.map((configuration) => configuration.id),
  );
  const activeAssertions = snapshot.spec_assertion.filter((assertion) =>
    activeConfigurationIds.has(assertion.configuration_id),
  );
  const activeAssertionIds = new Set(
    activeAssertions.map((assertion) => assertion.id),
  );
  snapshot = {
    ...snapshot,
    vehicle_configuration: activeConfigurations,
    spec_assertion: activeAssertions,
    assertion_evidence: snapshot.assertion_evidence.filter((link) =>
      activeAssertionIds.has(link.assertion_id),
    ),
    accepted_specification: snapshot.accepted_specification.filter((cell) =>
      activeConfigurationIds.has(cell.configuration_id),
    ),
    configuration_package: snapshot.configuration_package.filter((link) =>
      activeConfigurationIds.has(link.configuration_id),
    ),
  };
  // New definitions introduce unknown cells, never an inferred absence of equipment.
  const cells = [...snapshot.accepted_specification];
  const existing = new Set(
    cells.map((cell) => `${cell.configuration_id}/${cell.attribute_id}`),
  );
  for (const configuration of snapshot.vehicle_configuration)
    for (const attribute of snapshot.attribute_definition) {
      const id = `${configuration.id}/${attribute.id}`;
      if (!existing.has(id))
        cells.push({
          configuration_id: configuration.id,
          attribute_id: attribute.id,
          knowledge_status: 'NOT_REPORTED',
          assertion_id: null,
          reason: 'No accepted source assertion for this attribute.',
        });
    }
  snapshot = { ...snapshot, accepted_specification: cells };
  const statements = [
    { statement: 'MATCH (p:SpecSyncReview:ReviewProjection) DELETE p' },
    { statement: 'MATCH (n:SpecSyncCatalog) DETACH DELETE n' },
  ];
  const node = (table, label, props) =>
    statements.push({
      statement: `UNWIND $rows AS row CREATE (n:SpecSyncCatalog:${label}) SET n = row`,
      parameters: { rows: snapshot[table].map(props) },
    });
  node('brand', 'Brand', (r) => r);
  node('vehicle_model', 'VehicleModel', (r) => r);
  node('vehicle_configuration', 'VehicleConfiguration', (r) => r);
  node('attribute_definition', 'AttributeDefinition', (r) => r);
  node('source_revision', 'SourceRevision', (r) => r);
  node('evidence', 'Evidence', (r) => r);
  // Neo4j properties cannot store nested maps. Preserve typed values and qualifiers as JSON.
  node('spec_assertion', 'SpecAssertion', ({ value, qualifiers, ...r }) => ({
    ...r,
    value_json: JSON.stringify(value),
    qualifiers_json: JSON.stringify(qualifiers),
    value_number: r.value_type === 'NUMBER' ? value : null,
    value_text: r.value_type === 'TEXT' ? value : null,
    value_list: r.value_type === 'LIST' ? value : null,
  }));
  node('feature_package', 'FeaturePackage', (r) => r);
  node('accepted_specification', 'SpecificationCell', (r) => ({
    ...r,
    id: `${r.configuration_id}/${r.attribute_id}`,
  }));
  const edge = (table, left, leftKey, rel, right, rightKey, props = '') =>
    statements.push({
      statement: `UNWIND $rows AS row MATCH (l:SpecSyncCatalog:${left} {id: row.${leftKey}})
      MATCH (r:SpecSyncCatalog:${right} {id: row.${rightKey}}) CREATE (l)-[e:${rel}]->(r) ${props}`,
      parameters: {
        rows: snapshot[table].map((r) => ({
          ...r,
          cell_id: `${r.configuration_id}/${r.attribute_id}`,
          qualifiers_json: JSON.stringify(r.qualifiers ?? {}),
        })),
      },
    });
  edge('vehicle_model', 'VehicleModel', 'id', 'MADE_BY', 'Brand', 'brand_id');
  edge(
    'vehicle_configuration',
    'VehicleModel',
    'model_id',
    'HAS_CONFIGURATION',
    'VehicleConfiguration',
    'id',
  );
  edge(
    'vehicle_configuration',
    'VehicleConfiguration',
    'id',
    'IDENTIFIED_BY',
    'Evidence',
    'identity_evidence_id',
  );
  edge(
    'spec_assertion',
    'VehicleConfiguration',
    'configuration_id',
    'HAS_ASSERTION',
    'SpecAssertion',
    'id',
  );
  edge(
    'spec_assertion',
    'SpecAssertion',
    'id',
    'FOR_ATTRIBUTE',
    'AttributeDefinition',
    'attribute_id',
  );
  edge(
    'assertion_evidence',
    'SpecAssertion',
    'assertion_id',
    'SUPPORTED_BY',
    'Evidence',
    'evidence_id',
  );
  edge(
    'evidence',
    'Evidence',
    'id',
    'FROM_REVISION',
    'SourceRevision',
    'source_revision_id',
  );
  edge(
    'accepted_specification',
    'VehicleConfiguration',
    'configuration_id',
    'HAS_CELL',
    'SpecificationCell',
    'cell_id',
  );
  edge(
    'accepted_specification',
    'SpecificationCell',
    'cell_id',
    'FOR_ATTRIBUTE',
    'AttributeDefinition',
    'attribute_id',
  );
  edge(
    'accepted_specification',
    'SpecificationCell',
    'cell_id',
    'SELECTS',
    'SpecAssertion',
    'assertion_id',
  );
  edge(
    'feature_package',
    'FeaturePackage',
    'id',
    'FOR_MODEL',
    'VehicleModel',
    'model_id',
  );
  edge(
    'feature_package',
    'FeaturePackage',
    'id',
    'SUPPORTED_BY',
    'Evidence',
    'evidence_id',
  );
  edge(
    'configuration_package',
    'VehicleConfiguration',
    'configuration_id',
    'HAS_PACKAGE',
    'FeaturePackage',
    'package_id',
    'SET e.availability = row.availability, e.evidence_id = row.evidence_id',
  );
  edge(
    'package_item',
    'FeaturePackage',
    'package_id',
    'BUNDLES',
    'AttributeDefinition',
    'attribute_id',
    'SET e.qualifiers_json = row.qualifiers_json, e.evidence_id = row.evidence_id',
  );
  statements.push({
    statement: `CREATE (p:SpecSyncCatalog:CatalogProjection {id: 'catalog', fingerprint: $fingerprint, seed_versions: $versions, projected_at: datetime()})`,
    parameters: {
      fingerprint,
      versions: snapshot.seed_dataset.map((r) => r.version),
    },
  });
  return statements;
}

export const projectionConstraints = [
  'Brand',
  'VehicleModel',
  'VehicleConfiguration',
  'AttributeDefinition',
  'SourceRevision',
  'Evidence',
  'SpecAssertion',
  'FeaturePackage',
  'SpecificationCell',
  'CatalogProjection',
  'ManufacturerTerm',
  'OntologyRevision',
  'AttributeValue',
  'OntologyProposal',
  'OntologyProposalEvidence',
].map((label) => ({
  statement: `CREATE CONSTRAINT specsync_${label.toLowerCase()}_id IF NOT EXISTS FOR (n:${label}) REQUIRE n.id IS UNIQUE`,
}));
