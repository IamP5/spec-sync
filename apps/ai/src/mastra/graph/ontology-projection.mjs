/** API-owned ontology rows; unresolved proposals never become equivalence edges. */
export const ontologyTables = [
  'ontology_revision',
  'manufacturer_term',
  'attribute_value',
  'ontology_proposal',
  'ontology_proposal_evidence',
];

function properties(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) =>
      value !== null && typeof value === 'object'
        ? [`${key}_json`, JSON.stringify(value)]
        : [key, value],
    ),
  );
}

export function ontologyProjectionStatements(snapshot) {
  const statements = [];
  for (const [table, label, identify] of [
    ['ontology_revision', 'OntologyRevision', (r) => String(r.revision)],
    ['manufacturer_term', 'ManufacturerTerm', (r) => r.id],
    ['attribute_value', 'AttributeValue', (r) => `${r.attribute_id}/${r.code}`],
    ['ontology_proposal', 'OntologyProposal', (r) => r.id],
    ['ontology_proposal_evidence', 'OntologyProposalEvidence', (r) => r.id],
  ]) {
    statements.push({
      statement: `UNWIND $rows AS row CREATE (n:SpecSyncCatalog:${label}) SET n = row`,
      parameters: {
        rows: (snapshot[table] ?? []).map((row) => ({
          ...properties(row),
          id: identify(row),
        })),
      },
    });
  }
  statements.push(
    {
      statement:
        'MATCH (t:SpecSyncCatalog:ManufacturerTerm), (a:SpecSyncCatalog:AttributeDefinition) WHERE t.attribute_id=a.id CREATE (t)-[:TERM_FOR]->(a)',
    },
    {
      statement:
        'MATCH (v:SpecSyncCatalog:AttributeValue), (a:SpecSyncCatalog:AttributeDefinition) WHERE v.attribute_id=a.id CREATE (a)-[:ALLOWS_VALUE]->(v)',
    },
    {
      statement:
        'MATCH (e:SpecSyncCatalog:OntologyProposalEvidence), (p:SpecSyncCatalog:OntologyProposal) WHERE e.proposal_id=p.id CREATE (p)-[:SUPPORTED_BY]->(e)',
    },
    {
      statement:
        'MATCH (t:SpecSyncCatalog:ManufacturerTerm), (r:SpecSyncCatalog:OntologyRevision) WHERE t.introduced_revision=r.revision CREATE (t)-[:INTRODUCED_IN]->(r)',
    },
    {
      statement:
        "MATCH (p:SpecSyncCatalog:CatalogProjection {id:'catalog'}) SET p.ontology_revision=$revision",
      parameters: {
        revision: Math.max(
          0,
          ...(snapshot.ontology_revision ?? []).map((row) =>
            Number(row.revision),
          ),
        ),
      },
    },
  );
  return statements;
}
