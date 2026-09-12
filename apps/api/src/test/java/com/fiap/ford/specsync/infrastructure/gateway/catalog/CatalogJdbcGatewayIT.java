package com.fiap.ford.specsync.infrastructure.gateway.catalog;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.domain.catalog.Catalog;
import com.fiap.ford.specsync.domain.catalog.CatalogSearch;
import com.fiap.ford.specsync.domain.catalog.ComparisonSelection;
import com.fiap.ford.specsync.domain.catalog.SpecificationSelection;
import com.fiap.ford.specsync.domain.exceptions.DomainException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Exercises the actual JDBC adapter and production view with the curated fixture.
 * PostgreSQL migration/HTTP coverage also runs in ai:comparison-integration. */
class CatalogJdbcGatewayIT {
    private CatalogJdbcGateway gateway;
    private JdbcTemplate jdbc;

    @org.junit.jupiter.api.AfterEach
    void closeDatabase() {
        if (jdbc != null) jdbc.execute("SHUTDOWN");
    }

    private List<Catalog.Configuration> configurations;

    @BeforeEach
    void seedCatalog() throws Exception {
        var source = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";NON_KEYWORDS=VALUE", "sa", "");
        // Keep the in-memory database alive across the adapter's separate connections.
        source.setUrl(source.getUrl() + ";DB_CLOSE_DELAY=-1");
        jdbc = new JdbcTemplate(source);
        jdbc.execute("CREATE SCHEMA catalog");
        for (var ddl : List.of(
                "brand (id uuid primary key, name varchar)",
                "vehicle_model (id uuid primary key, brand_id uuid, name varchar)",
                "source_revision (id uuid primary key, path varchar, sha256 varchar, title varchar, provenance varchar, upstream_urls varchar, captured_on date, published_on date)",
                "evidence (id uuid primary key, source_revision_id uuid, line_start int, line_end int, excerpt varchar, locator varchar)",
                "vehicle_configuration (id uuid primary key, model_id uuid, name varchar, market varchar, model_year int, identity_status varchar, identity_evidence_id uuid, identity_note varchar, superseded_by uuid)",
                "vehicle_image (configuration_id uuid primary key, storage_bucket varchar, storage_object varchar, sha256 varchar, width int, height int, alt_text varchar, match_scope varchar, source_page_url varchar)",
                "attribute_definition (id uuid primary key, code varchar, label varchar, description varchar, value_type varchar, unit varchar)",
                "spec_assertion (id uuid primary key, configuration_id uuid, attribute_id uuid, value_type varchar, value varchar, availability varchar, qualifiers varchar, raw_value varchar, review_status varchar)",
                "assertion_evidence (assertion_id uuid, evidence_id uuid)",
                "accepted_specification (configuration_id uuid, attribute_id uuid, knowledge_status varchar, assertion_id uuid, reason varchar)")) {
            jdbc.execute("CREATE TABLE catalog." + ddl);
        }
        var json = JsonMapper.builder().build();
        var fixture = json.readValue(
                Files.readString(Path.of("data/curated-pickups.json")), new TypeReference<Map<String, Object>>() {});
        var named = new NamedParameterJdbcTemplate(source);
        for (var table : List.of(
                "brand",
                "vehicle_model",
                "source_revision",
                "evidence",
                "vehicle_configuration",
                "attribute_definition",
                "spec_assertion",
                "assertion_evidence",
                "accepted_specification")) {
            @SuppressWarnings("unchecked")
            var rows = (List<Map<String, Object>>) ((Map<?, ?>) fixture.get("tables")).get(table);
            for (var row : rows) {
                var parameters = new LinkedHashMap<>(row);
                for (var key : List.of("value", "qualifiers", "upstream_urls")) {
                    if (parameters.get(key) != null) parameters.put(key, json.writeValueAsString(parameters.get(key)));
                }
                named.update(
                        "INSERT INTO catalog." + table + " (" + String.join(",", row.keySet()) + ") VALUES ("
                                + String.join(
                                        ",",
                                        row.keySet().stream().map(k -> ":" + k).toList()) + ")",
                        parameters);
            }
        }
        var migration = Files.readString(Path.of("src/main/resources/db/migration/V1__vehicle_knowledge.sql"));
        jdbc.execute(migration.substring(migration.indexOf("CREATE VIEW catalog.specification_matrix")));
        gateway = new CatalogJdbcGateway(source);
        configurations =
                gateway.search(new CatalogSearch("", null, null, 100, 0)).items();
    }

    private UUID id(String version) {
        return configurations.stream()
                .filter(c -> c.name().contains(version))
                .findFirst()
                .orElseThrow()
                .id();
    }

    @Test
    void deliversPublicPrimaryImageThroughSearchSpecificationsAndComparison() {
        var configurationId = id("Black");
        var sha = "a".repeat(64);
        var object = "vehicles/primary/" + sha + "/ranger.jpg";
        jdbc.update(
                "INSERT INTO catalog.vehicle_image VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                configurationId,
                "specsync-dev-vehicle-images",
                object,
                sha,
                1280,
                509,
                "Ford Ranger Black",
                "ILLUSTRATIVE",
                "https://www.ford.com.br/picapes/ranger/");
        var image = gateway.search(new CatalogSearch("Black", null, null, 20, 0))
                .items()
                .getFirst()
                .primaryImage();
        assertNotNull(image);
        assertEquals("https://storage.googleapis.com/specsync-dev-vehicle-images/" + object, image.url());
        assertEquals(1280, image.width());
        assertEquals(509, image.height());
        assertEquals("ILLUSTRATIVE", image.matchScope());
        assertEquals(
                image,
                gateway.specifications(new SpecificationSelection(List.of(configurationId), null))
                        .configurations()
                        .getFirst()
                        .primaryImage());
        var comparison = gateway.compare(new ComparisonSelection(List.of(configurationId, id("Limited")), null));
        assertEquals(image, comparison.configurations().getFirst().primaryImage());
        assertNull(comparison.configurations().getLast().primaryImage());
    }

    @Test
    void omitsImagesOutsidePublicVehicleStorageWithoutHidingTheConfiguration() {
        var sha = "a".repeat(64);
        jdbc.update(
                "INSERT INTO catalog.vehicle_image VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id("Black"),
                "specsync-dev-files",
                "vehicles/primary/" + sha + "/ranger.jpg",
                sha,
                1280,
                509,
                "Ford Ranger Black",
                "ILLUSTRATIVE",
                "https://www.ford.com.br/");
        assertNull(gateway.search(new CatalogSearch("Black", null, null, 20, 0))
                .items()
                .getFirst()
                .primaryImage());
        jdbc.update(
                "UPDATE catalog.vehicle_image SET storage_bucket = ?, storage_object = ?",
                "specsync-dev-vehicle-images",
                "private/document.pdf");
        assertNull(gateway.search(new CatalogSearch("Black", null, null, 20, 0))
                .items()
                .getFirst()
                .primaryImage());
    }

    @Test
    void searchesLiteralTextAndPaginatesDeterministically() {
        var first = gateway.search(new CatalogSearch("rAnGeR", "BR", 2026, 1, 0));
        var second = gateway.search(new CatalogSearch("Ranger", "BR", 2026, 1, 1));
        assertTrue(first.hasMore());
        assertFalse(second.hasMore());
        assertNotEquals(first.items().getFirst().id(), second.items().getFirst().id());
        assertEquals(
                0,
                gateway.search(new CatalogSearch("%", null, null, 20, 0))
                        .items()
                        .size());
        assertEquals(
                0,
                gateway.search(new CatalogSearch("' OR 1=1 --", null, null, 20, 0))
                        .items()
                        .size());
        assertEquals(
                0,
                gateway.search(new CatalogSearch("", "US", 2026, 20, 0)).items().size());
        assertEquals(
                0,
                gateway.search(new CatalogSearch("", null, 2025, 20, 0)).items().size());
    }

    @Test
    void hidesSupersededConfigurationsAndRejectsTheirIds() {
        var canonicalId = id("Black");
        var duplicateId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO catalog.vehicle_configuration (
                    id, model_id, name, market, model_year, identity_status,
                    identity_evidence_id, identity_note, superseded_by
                )
                SELECT ?, model_id, ?, market, model_year, identity_status,
                    identity_evidence_id, identity_note, ?
                FROM catalog.vehicle_configuration WHERE id = ?
                """, duplicateId, "Black duplicate", canonicalId, canonicalId);

        assertTrue(gateway.search(new CatalogSearch("Black duplicate", null, null, 20, 0))
                .items()
                .isEmpty());
        assertThrows(
                DomainException.class,
                () -> gateway.specifications(new SpecificationSelection(List.of(duplicateId), null)));
    }

    @Test
    void returnsOrderedCompleteMatrixWithUnresolvedConflicts() {
        var ids = List.of(id("SRX"), id("Black"));
        var comparison = gateway.compare(new ComparisonSelection(ids, List.of("camera_360", "drivetrain")));
        assertEquals(
                ids,
                comparison.configurations().stream()
                        .map(Catalog.Configuration::id)
                        .toList());
        assertEquals(
                List.of("camera_360", "drivetrain"),
                comparison.rows().stream().map(r -> r.attribute().code()).toList());
        var hiluxCamera = comparison.rows().getFirst().cells().getFirst();
        var blackDrive = comparison.rows().getLast().cells().getLast();
        for (var cell : List.of(hiluxCamera, blackDrive)) {
            assertEquals("CONFLICTING", cell.knowledgeStatus());
            assertNull(cell.selectedObservationId());
            assertEquals(2, cell.observations().size());
            assertTrue(cell.observations().stream().allMatch(o -> !o.evidence().isEmpty()));
        }
        var unknown = comparison.rows().getLast().cells().getFirst();
        assertEquals("NOT_REPORTED", unknown.knowledgeStatus());
        assertNull(unknown.selectedObservationId());
    }

    @Test
    void preservesPrecisionOptionalityAndEvidence() {
        var comparison = gateway.compare(
                new ComparisonSelection(List.of(id("SRX"), id("Limited")), List.of("torque_max", "camera_360")));
        var torque =
                comparison.rows().getFirst().cells().getFirst().observations().getFirst();
        assertEquals(new BigDecimal("499.158485"), torque.value());
        assertEquals("Nm", comparison.rows().getFirst().attribute().unit());
        assertFalse(torque.qualifiers().isEmpty());
        assertEquals("CURATED_NOTES", torque.evidence().getFirst().provenance());
        assertEquals(64, torque.evidence().getFirst().sha256().length());
        assertTrue(torque.evidence().getFirst().lineStart() > 0);
        var camera = comparison.rows().getLast().cells().getLast();
        assertEquals("KNOWN", camera.knowledgeStatus());
        assertEquals(
                "OPTIONAL",
                camera.observations().stream()
                        .filter(o -> o.id().equals(camera.selectedObservationId()))
                        .findFirst()
                        .orElseThrow()
                        .availability());
    }

    @Test
    void rejectsUnknownSelectionsInsteadOfReturningPartialComparisons() {
        assertThrows(
                DomainException.class,
                () -> gateway.compare(new ComparisonSelection(List.of(id("Black"), UUID.randomUUID()), null)));
        assertThrows(
                DomainException.class,
                () -> gateway.compare(
                        new ComparisonSelection(List.of(id("Black"), id("Limited")), List.of("invented"))));
    }

    @Test
    void expandsOmittedAttributesWithoutLeakingOtherConfigurations() {
        var comparison = gateway.compare(new ComparisonSelection(List.of(id("Black"), id("Limited")), null));
        assertEquals(21, comparison.rows().size());
        assertTrue(comparison.rows().stream().allMatch(row -> row.cells().size() == 2));
    }
}
