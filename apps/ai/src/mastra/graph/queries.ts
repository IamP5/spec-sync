// Fixed, parameterized retrieval queries. Never accept Cypher from a tool input.
export const CONCEPTS = `
 MATCH (a:SpecSyncCatalog:AttributeDefinition)
 OPTIONAL MATCH (alias:SpecSyncCatalog:AttributeAlias)-[:ALIAS_OF]->(a)
 WITH a, collect(alias.term) AS aliases
 OPTIONAL MATCH (term:SpecSyncCatalog:ManufacturerTerm)-[:TERM_FOR]->(a)
 WHERE $brand IS NOT NULL AND toLower(term.brand)=toLower($brand)
   AND (term.market IS NULL OR term.market='' OR term.market=$market)
   AND (term.model IS NULL OR term.model='' OR toLower(term.model)=toLower($model))
   AND (term.model_year IS NULL OR term.model_year=0 OR term.model_year=$year)
 WITH a, aliases, collect(term{.term,.brand,.model,.market,.language,.model_year,.introduced_revision,.source_sha256,.locator}) AS manufacturerTerms
 WHERE $q = '' OR toLower(a.code) = toLower($q) OR toLower(a.label) CONTAINS toLower($q)
   OR toLower(coalesce(a.description,'')) CONTAINS toLower($q)
   OR any(term IN aliases WHERE toLower(term) = toLower($q))
   OR any(term IN manufacturerTerms WHERE toLower(term.term) = toLower($q))
 RETURN {id:a.id, code:a.code, label:a.label, description:a.description,
   unit:a.unit, valueType:a.value_type, aliases:aliases, manufacturerTerms:manufacturerTerms} AS item
 ORDER BY item.code LIMIT $limit
`;

export const CAPABILITIES = `
 MATCH (c:SpecSyncCatalog:VehicleConfiguration)-[:HAS_CELL]->(cell:SpecificationCell)-[:FOR_ATTRIBUTE]->(a:AttributeDefinition {code:$attributeCode})
 WHERE ($market IS NULL OR c.market=$market) AND ($year IS NULL OR c.model_year=$year)
 OPTIONAL MATCH (cell)-[:SELECTS]->(s:SpecAssertion)
 WITH c,cell,a,s WHERE cell.knowledge_status='KNOWN' AND s.review_status <> 'REJECTED'
 AND (s.availability='STANDARD' OR ($optional AND s.availability='OPTIONAL'))
 MATCH (s)-[:SUPPORTED_BY]->(e:Evidence)
 OPTIONAL MATCH (c)-[cp:HAS_PACKAGE]->(p:FeaturePackage)-[:BUNDLES]->(a)
 WITH c,cell,a,s,collect(DISTINCT e.id) AS evidenceIds,
 collect(DISTINCT CASE WHEN p IS NULL THEN null ELSE {name:p.name, availability:cp.availability, evidenceId:cp.evidence_id} END) AS packages
 RETURN {configurationId:c.id, name:c.name, market:c.market, modelYear:c.model_year,
 identityStatus:c.identity_status, attributeCode:a.code, availability:s.availability,
 observationId:s.id, qualifiersJson:s.qualifiers_json, evidenceIds:evidenceIds, packages:packages} AS item
 ORDER BY item.name, item.configurationId LIMIT $limit
`;

export const REVIEW_EXPANSION = `
 MATCH (chunk:SpecSyncReview:ContentChunk)-[:FROM_REVISION]->(revision:SpecSyncReview:SourceRevision)
 MATCH (o:SpecSyncReview:ReviewObservation)-[:SUPPORTED_BY]->(chunk)
 WHERE o.review_status='ACCEPTED'
 AND ($configurationId IS NULL OR o.configuration_id=$configurationId
   OR (o.configuration_id IS NULL AND o.model_id=$modelId))
 AND ($attributeCode IS NULL OR EXISTS {
   MATCH (o)-[:ABOUT]->(:SpecSyncReview:ReviewAspect)-[:RELATES_TO]->(attr:SpecSyncCatalog:AttributeDefinition {code:$attributeCode})
 })
`;

export const REVIEW_RETURN = `
 RETURN {recordType:'review-passage', id:o.id, evidenceId:chunk.id, excerpt:substring(chunk.text,o.start_offset,o.end_offset-o.start_offset),
 context:chunk.text, title:revision.title, url:revision.url, mediaType:revision.media_type,
 author:revision.author, publishedOn:revision.published_on, capturedOn:revision.captured_on,
 startSeconds:chunk.start_seconds, endSeconds:chunk.end_seconds, locator:chunk.locator,
 kind:o.kind, sentiment:o.sentiment, conditions:o.conditions,
 configurationId:o.configuration_id, modelId:o.model_id,
 scope:CASE WHEN o.configuration_id IS NULL THEN 'MODEL' ELSE 'CONFIGURATION' END} AS item
 ORDER BY item.id LIMIT $limit
`;
