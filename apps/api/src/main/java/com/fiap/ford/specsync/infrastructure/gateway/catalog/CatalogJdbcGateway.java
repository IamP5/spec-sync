package com.fiap.ford.specsync.infrastructure.gateway.catalog;

import com.fiap.ford.specsync.domain.catalog.Catalog;
import com.fiap.ford.specsync.domain.catalog.CatalogGateway;
import com.fiap.ford.specsync.domain.catalog.CatalogSearch;
import com.fiap.ford.specsync.domain.catalog.ComparisonSelection;
import com.fiap.ford.specsync.domain.catalog.SpecificationSelection;
import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.validation.Error;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class CatalogJdbcGateway implements CatalogGateway {
    private static final String CONFIGURATIONS = """
        SELECT c.*, b.name AS brand, m.name AS model,
            i.storage_bucket AS image_bucket, i.storage_object AS image_object,
            i.sha256 AS image_sha256, i.width AS image_width, i.height AS image_height,
            i.alt_text AS image_alt_text, i.match_scope AS image_match_scope,
            i.source_page_url AS image_source_page_url
        FROM catalog.vehicle_configuration c
        JOIN catalog.vehicle_model m ON m.id = c.model_id
        JOIN catalog.brand b ON b.id = m.brand_id
        LEFT JOIN catalog.vehicle_image i ON i.configuration_id = c.id
        """;
    private final NamedParameterJdbcTemplate jdbc;
    private final JsonMapper json;

    public CatalogJdbcGateway(DataSource dataSource) {
        jdbc = new NamedParameterJdbcTemplate(Objects.requireNonNull(dataSource));
        json = JsonMapper.builder()
                .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
                .build();
    }

    @Override
    public Catalog.Page search(CatalogSearch search) {
        var sql = new StringBuilder(CONFIGURATIONS)
                .append(" WHERE POSITION(LOWER(:q) IN LOWER(b.name || ' ' || m.name || ' ' || c.name)) > 0");
        var parameters = new MapSqlParameterSource("q", search.query())
                .addValue("limit", search.limit() + 1)
                .addValue("offset", search.offset());
        if (search.market() != null) {
            sql.append(" AND c.market = :market");
            parameters.addValue("market", search.market());
        }
        if (search.modelYear() != null) {
            sql.append(" AND c.model_year = :year");
            parameters.addValue("year", search.modelYear());
        }
        sql.append(" ORDER BY b.name, m.name, c.name, c.market, c.model_year, c.id LIMIT :limit OFFSET :offset");
        var found = jdbc.query(sql.toString(), parameters, (rs, n) -> configuration(rs));
        return new Catalog.Page(
                List.copyOf(found.subList(0, Math.min(search.limit(), found.size()))),
                search.limit(),
                search.offset(),
                found.size() > search.limit());
    }

    @Override
    public List<Catalog.Attribute> attributes() {
        return List.copyOf(jdbc.query(
                "SELECT * FROM catalog.attribute_definition ORDER BY code", Map.of(), (rs, n) -> attribute(rs)));
    }

    /** All component reads see one PostgreSQL snapshot, including publication and provenance. */
    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Catalog.Comparison compare(ComparisonSelection selection) {
        return matrix(selection.configurationIds(), selection.attributes());
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Catalog.Comparison specifications(SpecificationSelection selection) {
        return matrix(selection.configurationIds(), selection.attributes());
    }

    private Catalog.Comparison matrix(List<UUID> ids, List<String> codes) {
        var parameters = new MapSqlParameterSource("ids", ids);
        var found = jdbc.query(CONFIGURATIONS + " WHERE c.id IN (:ids)", parameters, (rs, n) -> configuration(rs));
        var configurationsById = new LinkedHashMap<UUID, Catalog.Configuration>();
        found.forEach(c -> configurationsById.put(c.id(), c));
        for (var id : ids) {
            if (!configurationsById.containsKey(id))
                throw DomainException.with(new Error("configurationIds", "Unknown configuration: " + id));
        }
        var allAttributes = attributes();
        var attributesByCode = new LinkedHashMap<String, Catalog.Attribute>();
        allAttributes.forEach(a -> attributesByCode.put(a.code(), a));
        for (var code : codes) {
            if (!attributesByCode.containsKey(code))
                throw DomainException.with(new Error("attributes", "Unknown attribute: " + code));
        }
        var selectedAttributes = codes.isEmpty()
                ? allAttributes
                : codes.stream().map(attributesByCode::get).toList();
        var configurations = ids.stream().map(configurationsById::get).toList();
        if (selectedAttributes.isEmpty()) return new Catalog.Comparison(configurations, List.of());
        parameters.addValue(
                "attributeIds",
                selectedAttributes.stream().map(Catalog.Attribute::id).toList());

        var evidenceByAssertion = new LinkedHashMap<UUID, List<Catalog.Evidence>>();
        jdbc.query("""
            SELECT ae.assertion_id, e.*, s.title, s.path, s.sha256, s.provenance,
                s.captured_on, s.published_on, s.upstream_urls
            FROM catalog.spec_assertion a
            JOIN catalog.assertion_evidence ae ON ae.assertion_id = a.id
            JOIN catalog.evidence e ON e.id = ae.evidence_id
            JOIN catalog.source_revision s ON s.id = e.source_revision_id
            WHERE a.configuration_id IN (:ids) AND a.attribute_id IN (:attributeIds)
                AND a.review_status <> 'REJECTED'
            ORDER BY ae.assertion_id, e.id
            """, parameters, (org.springframework.jdbc.core.RowCallbackHandler) rs -> evidenceByAssertion
                .computeIfAbsent(uuid(rs, "assertion_id"), ignored -> new ArrayList<>())
                .add(evidence(rs)));

        var observationsByCell = new LinkedHashMap<CellKey, List<Catalog.Observation>>();
        jdbc.query("""
            SELECT * FROM catalog.spec_assertion
            WHERE configuration_id IN (:ids) AND attribute_id IN (:attributeIds) AND review_status <> 'REJECTED'
            ORDER BY id
            """, parameters, (org.springframework.jdbc.core.RowCallbackHandler) rs -> {
            var id = uuid(rs, "id");
            var evidence = evidenceByAssertion.getOrDefault(id, List.of());
            if (evidence.isEmpty()) return;
            var observation = new Catalog.Observation(
                    id,
                    readValue(rs.getString("value")),
                    rs.getString("availability"),
                    readQualifiers(rs.getString("qualifiers")),
                    rs.getString("raw_value"),
                    rs.getString("review_status"),
                    List.copyOf(evidence));
            var key = new CellKey(uuid(rs, "configuration_id"), uuid(rs, "attribute_id"));
            observationsByCell
                    .computeIfAbsent(key, ignored -> new ArrayList<>())
                    .add(observation);
        });

        var cells = new LinkedHashMap<CellKey, Catalog.Cell>();
        jdbc.query("""
            SELECT configuration_id, attribute_id, knowledge_status, reason, assertion_id
            FROM catalog.specification_matrix
            WHERE configuration_id IN (:ids) AND attribute_id IN (:attributeIds)
            """, parameters, (org.springframework.jdbc.core.RowCallbackHandler) rs -> {
            var key = new CellKey(uuid(rs, "configuration_id"), uuid(rs, "attribute_id"));
            cells.put(
                    key,
                    new Catalog.Cell(
                            key.configurationId(),
                            rs.getString("knowledge_status"),
                            rs.getString("reason"),
                            uuid(rs, "assertion_id"),
                            List.copyOf(observationsByCell.getOrDefault(key, List.of()))));
        });
        var rows = selectedAttributes.stream()
                .map(a -> new Catalog.Row(
                        a,
                        configurations.stream()
                                .map(c -> Objects.requireNonNull(cells.get(new CellKey(c.id(), a.id()))))
                                .toList()))
                .toList();
        return new Catalog.Comparison(configurations, rows);
    }

    private Catalog.Configuration configuration(ResultSet rs) throws SQLException {
        return new Catalog.Configuration(
                uuid(rs, "id"),
                rs.getString("brand"),
                rs.getString("model"),
                rs.getString("name"),
                rs.getString("market"),
                rs.getObject("model_year", Integer.class),
                rs.getString("identity_status"),
                rs.getString("identity_note"),
                uuid(rs, "identity_evidence_id"),
                image(rs));
    }

    private Catalog.Image image(ResultSet rs) throws SQLException {
        var sha256 = rs.getString("image_sha256");
        if (sha256 == null || !sha256.matches("[a-f0-9]{64}")) return null;
        var bucket = rs.getString("image_bucket");
        var object = rs.getString("image_object");
        // Only vehicle image buckets are public; never advertise private file objects.
        if (bucket == null
                || !bucket.matches("[a-z0-9][a-z0-9._-]*-vehicle-images")
                || object == null
                || !object.matches("vehicles/primary/" + sha256 + "/[a-zA-Z0-9._-]+")) return null;
        return new Catalog.Image(
                "https://storage.googleapis.com/" + bucket + "/" + object,
                sha256,
                rs.getInt("image_width"),
                rs.getInt("image_height"),
                rs.getString("image_alt_text"),
                rs.getString("image_match_scope"),
                rs.getString("image_source_page_url"));
    }

    private Catalog.Attribute attribute(ResultSet rs) throws SQLException {
        return new Catalog.Attribute(
                uuid(rs, "id"),
                rs.getString("code"),
                rs.getString("label"),
                rs.getString("description"),
                rs.getString("value_type"),
                rs.getString("unit"));
    }

    private Catalog.Evidence evidence(ResultSet rs) throws SQLException {
        return new Catalog.Evidence(
                uuid(rs, "id"),
                uuid(rs, "source_revision_id"),
                rs.getString("title"),
                rs.getString("path"),
                rs.getString("sha256"),
                rs.getString("provenance"),
                rs.getObject("captured_on", LocalDate.class),
                rs.getObject("published_on", LocalDate.class),
                List.copyOf(json.readValue(rs.getString("upstream_urls"), new TypeReference<List<String>>() {})),
                rs.getInt("line_start"),
                rs.getInt("line_end"),
                rs.getString("locator"),
                rs.getString("excerpt"));
    }

    private Object readValue(String value) {
        return value == null ? null : json.readValue(value, Object.class);
    }

    private Map<String, Object> readQualifiers(String value) {
        return java.util.Collections.unmodifiableMap(
                json.readValue(value, new TypeReference<Map<String, Object>>() {}));
    }

    private static UUID uuid(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, UUID.class);
    }

    private record CellKey(UUID configurationId, UUID attributeId) {}
}
