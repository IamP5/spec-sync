package com.fiap.ford.specsync.domain.catalog;

import com.fiap.ford.specsync.domain.shared.ValueObject;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Read models for sourced comparisons; no persistence entities cross the gateway. */
public final class Catalog {
    private Catalog() {}

    public record Configuration(
            UUID id,
            String brand,
            String model,
            String name,
            String market,
            Integer modelYear,
            String identityStatus,
            String identityNote,
            UUID identityEvidenceId,
            Image primaryImage)
            implements ValueObject {}

    public record Image(
            String url, String sha256, int width, int height, String altText, String matchScope, String sourcePageUrl)
            implements ValueObject {}

    public record Attribute(UUID id, String code, String label, String description, String valueType, String unit)
            implements ValueObject {}

    public record Evidence(
            UUID id,
            UUID sourceRevisionId,
            String title,
            String path,
            String sha256,
            String provenance,
            LocalDate capturedOn,
            LocalDate publishedOn,
            List<String> upstreamUrls,
            int lineStart,
            int lineEnd,
            String locator,
            String excerpt)
            implements ValueObject {}

    public record Observation(
            UUID id,
            Object value,
            String availability,
            Map<String, Object> qualifiers,
            String rawValue,
            String reviewStatus,
            List<Evidence> evidence)
            implements ValueObject {}

    public record Cell(
            UUID configurationId,
            String knowledgeStatus,
            String reason,
            UUID selectedObservationId,
            List<Observation> observations)
            implements ValueObject {}

    public record Row(Attribute attribute, List<Cell> cells) implements ValueObject {}

    public record Comparison(List<Configuration> configurations, List<Row> rows) implements ValueObject {}

    public record Page(List<Configuration> items, int limit, int offset, boolean hasMore) implements ValueObject {}
}
