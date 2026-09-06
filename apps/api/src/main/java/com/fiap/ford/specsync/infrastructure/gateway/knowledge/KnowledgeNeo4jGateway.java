package com.fiap.ford.specsync.infrastructure.gateway.knowledge;

import com.fiap.ford.specsync.domain.knowledge.*;
import com.fiap.ford.specsync.infrastructure.configuration.KnowledgeProperties;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class KnowledgeNeo4jGateway implements KnowledgeGateway {
    private final KnowledgeProperties properties;
    private final HttpClient http =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final JsonMapper json = JsonMapper.builder().build();

    public KnowledgeNeo4jGateway(KnowledgeProperties properties) {
        this.properties = Objects.requireNonNull(properties);
    }

    private static final String CONCEPTS = """
 MATCH (a:SpecSyncCatalog:AttributeDefinition)
 OPTIONAL MATCH (alias:SpecSyncCatalog:AttributeAlias)-[:ALIAS_OF]->(a)
 WITH a, collect(alias.term) AS aliases
 WHERE $q = '' OR toLower(a.code) = toLower($q) OR toLower(a.label) CONTAINS toLower($q)
   OR toLower(coalesce(a.description,'')) CONTAINS toLower($q)
   OR any(term IN aliases WHERE toLower(term) = toLower($q))
 RETURN {id:a.id, code:a.code, label:a.label, description:a.description,
   unit:a.unit, valueType:a.value_type, aliases:aliases} AS item
 ORDER BY item.code LIMIT $limit
 """;
    private static final String CAPABILITIES = """
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
 """;
    private static final String REVIEW_EXPANSION = """
 MATCH (chunk:SpecSyncReview:ContentChunk)-[:FROM_REVISION]->(revision:SpecSyncReview:SourceRevision)
 MATCH (o:SpecSyncReview:ReviewObservation)-[:SUPPORTED_BY]->(chunk)
 WHERE o.review_status='ACCEPTED'
 AND ($configurationId IS NULL OR o.configuration_id=$configurationId
   OR (o.configuration_id IS NULL AND o.model_id=$modelId))
 AND ($attributeCode IS NULL OR EXISTS {
   MATCH (o)-[:ABOUT]->(:SpecSyncReview:ReviewAspect)-[:RELATES_TO]->(attr:SpecSyncCatalog:AttributeDefinition {code:$attributeCode})
 })
 """;
    private static final String REVIEW_RETURN = """
 RETURN {id:o.id, evidenceId:chunk.id, excerpt:substring(chunk.text,o.start_offset,o.end_offset-o.start_offset),
 context:chunk.text, title:revision.title, url:revision.url, mediaType:revision.media_type,
 author:revision.author, publishedOn:revision.published_on, capturedOn:revision.captured_on,
 startSeconds:chunk.start_seconds, endSeconds:chunk.end_seconds, locator:chunk.locator,
 kind:o.kind, sentiment:o.sentiment, conditions:o.conditions,
 configurationId:o.configuration_id, modelId:o.model_id,
 scope:CASE WHEN o.configuration_id IS NULL THEN 'MODEL' ELSE 'CONFIGURATION' END} AS item
 ORDER BY item.id LIMIT $limit
 """;

    @Override
    public KnowledgeResult retrieve(KnowledgeQuery q) {
        if (properties.url() == null || properties.url().isBlank())
            return unavailable("Graph retrieval is not configured.");
        var params = new HashMap<String, Object>();
        params.put("q", q.query());
        params.put("limit", q.limit());
        params.put("attributeCode", q.attributeCode());
        params.put("market", q.market());
        params.put("year", q.modelYear());
        params.put("optional", q.includeOptional());
        params.put(
                "configurationId",
                q.configurationId() == null ? null : q.configurationId().toString());
        params.put("modelId", null);
        try {
            var versionResult = query(
                    "MATCH (p:CatalogProjection {id:'catalog'}) RETURN {version:p.fingerprint} AS item", Map.of());
            if (versionResult.isEmpty()) return unavailable("Catalog graph has not been projected.");
            String version = Objects.toString(versionResult.getFirst().get("version"), "");
            if (q.kind() == KnowledgeQuery.Kind.CONCEPTS) return result(query(CONCEPTS, params), version);
            if (q.kind() == KnowledgeQuery.Kind.CAPABILITIES) return result(query(CAPABILITIES, params), version);
            if (q.configurationId() != null) {
                var configs = query(
                        "MATCH (c:SpecSyncCatalog:VehicleConfiguration {id:$configurationId}) RETURN {modelId:c.model_id} AS item",
                        params);
                if (configs.isEmpty())
                    return new KnowledgeResult(
                            "EMPTY",
                            "Configuration is absent from this graph snapshot; resolve it in the catalog.",
                            version,
                            List.of());
                params.put("modelId", configs.getFirst().get("modelId"));
            }
            if (q.kind() == KnowledgeQuery.Kind.EVIDENCE) {
                var evidence = query("""
      MATCH (e:SpecSyncCatalog:Evidence {id:$q})-[:FROM_REVISION]->(s:SourceRevision)
      RETURN {evidenceId:e.id, excerpt:e.excerpt, locator:e.locator, title:s.title,
       path:s.path, provenance:s.provenance, upstreamUrls:s.upstream_urls} AS item
      """, params);
                if (!evidence.isEmpty()) return result(evidence, version);
                return result(query(REVIEW_EXPANSION + " AND chunk.id=$q\n" + REVIEW_RETURN, params), version);
            }
            var reviewVersion = query(
                    "MATCH (p:SpecSyncReview:ReviewProjection {id:'reviews'}) RETURN {version:p.fingerprint,embeddingModel:p.embedding_model} AS item",
                    Map.of());
            if (reviewVersion.isEmpty())
                return unavailable(
                        "No review index is available. External discovery can find links, but cannot supply verified quotations.");
            version += "/" + reviewVersion.getFirst().get("version");
            if (q.query().isBlank() || q.kind() == KnowledgeQuery.Kind.RELATED_REVIEWS)
                return result(query(REVIEW_EXPANSION + REVIEW_RETURN, params), version);
            // Search candidates before graph expansion; rank fusion combines independent scales.
            params.put(
                    "search",
                    Arrays.stream(q.query().split("\\s+"))
                            .map(t -> t.replaceAll("[^\\p{L}\\p{N}_]", ""))
                            .filter(t -> !t.isBlank())
                            .map(t -> "\"" + t + "\"")
                            .reduce((a, b) -> a + " OR " + b)
                            .orElse("\"\""));
            params.put("candidateLimit", Math.min(300, q.limit() * 10));
            var lexical = query("""
     CALL db.index.fulltext.queryNodes('review_text',$search) YIELD node,score
     RETURN {id:node.id, score:score} AS item ORDER BY item.score DESC LIMIT $candidateLimit
     """, params);
            List<Map<String, Object>> semantic = List.of();
            if (!q.embedding().isEmpty()) {
                if (properties.embeddingModel() == null
                        || properties.embeddingModel().isBlank()
                        || !properties
                                .embeddingModel()
                                .equals(reviewVersion.getFirst().get("embeddingModel")))
                    return unavailable("The query embedding model does not match the indexed review model.");
                params.put("embedding", q.embedding());
                semantic = query("""
      CALL db.index.vector.queryNodes('review_embedding',$candidateLimit,$embedding) YIELD node,score
      RETURN {id:node.id,score:score} AS item ORDER BY item.score DESC
      """, params);
            }
            var ranks = new HashMap<String, Double>();
            for (var list : List.of(lexical, semantic))
                for (int i = 0; i < list.size(); i++)
                    ranks.merge(list.get(i).get("id").toString(), 1.0 / (60 + i + 1), Double::sum);
            params.put("chunkIds", ranks.keySet());
            params.put("limit", 300);
            var expanded = query(REVIEW_EXPANSION + " AND chunk.id IN $chunkIds\n" + REVIEW_RETURN, params);
            var items = expanded.stream()
                    .sorted(Comparator.<Map<String, Object>>comparingDouble(
                                    m -> ranks.getOrDefault(m.get("evidenceId"), 0.0))
                            .reversed()
                            .thenComparing(m -> m.get("id").toString()))
                    .limit(q.limit())
                    .toList();
            return result(items, version);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return unavailable("Graph request interrupted.");
        } catch (Exception e) {
            return unavailable(
                    "Graph retrieval failed. Retry or use the catalog comparison; no missing-data conclusion can be drawn.");
        }
    }

    private KnowledgeResult result(List<Map<String, Object>> items, String version) {
        try {
            var marker = query(
                    "MATCH (p:CatalogProjection {id:'catalog'}) RETURN {version:p.fingerprint} AS item", Map.of());
            if (marker.isEmpty() || !Objects.equals(marker.getFirst().get("version"), version.split("/")[0]))
                return unavailable("Graph changed during retrieval; retry.");
            if (version.contains("/")) {
                var reviews = query(
                        "MATCH (p:SpecSyncReview:ReviewProjection {id:'reviews'}) RETURN {version:p.fingerprint} AS item",
                        Map.of());
                if (reviews.isEmpty() || !Objects.equals(reviews.getFirst().get("version"), version.split("/")[1]))
                    return unavailable("Review index changed during retrieval; retry.");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return unavailable("Graph request interrupted.");
        } catch (Exception e) {
            return unavailable("Could not verify graph snapshot freshness.");
        }

        return new KnowledgeResult(
                items.isEmpty() ? "EMPTY" : "OK",
                items.isEmpty()
                        ? "No matching indexed evidence in this snapshot."
                        : "Results from a derived graph snapshot; verify selected specification values through the catalog API.",
                version,
                items);
    }

    private KnowledgeResult unavailable(String message) {
        return new KnowledgeResult("UNAVAILABLE", message, null, List.of());
    }

    private List<Map<String, Object>> query(String cypher, Map<String, Object> params)
            throws java.io.IOException, InterruptedException {
        var body = json.writeValueAsString(
                Map.of("statements", List.of(Map.of("statement", cypher, "parameters", params))));
        var auth = Base64.getEncoder()
                .encodeToString((properties.username() + ":" + properties.password()).getBytes(StandardCharsets.UTF_8));
        var request = HttpRequest.newBuilder(URI.create(properties.url().replaceAll("/+$", "") + "/db/neo4j/tx/commit"))
                .timeout(Duration.ofSeconds(8))
                .header("Content-Type", "application/json")
                .header("Authorization", "Basic " + auth)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        var response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) throw new java.io.IOException("Graph request failed");
        JsonNode root = json.readTree(response.body());
        if (!root.path("errors").isArray() || !root.path("errors").isEmpty())
            throw new java.io.IOException("Graph query failed");
        var rows = new ArrayList<Map<String, Object>>();
        for (var row : root.path("results").path(0).path("data"))
            rows.add(json.convertValue(row.path("row").path(0), new TypeReference<Map<String, Object>>() {}));
        return rows;
    }
}
