package com.fiap.ford.specsync.domain.research;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import com.fiap.ford.specsync.domain.shared.ValueObject;
import com.fiap.ford.specsync.domain.validation.Error;
import java.net.URI;
import java.time.Instant;
import java.util.*;

/** Private requests subscribe to public-source work; no subscriber identity belongs to the work. */
public final class Research {
    private Research() {}

    public static void require(boolean valid, String message) {
        if (!valid) throw DomainException.with(new Error("research", message));
    }

    public static void requireIdentity(UUID id, String uid) {
        require(
                id != null && uid != null && !uid.isBlank() && uid.length() <= 128,
                "A valid request identity is required");
    }

    public static String normalizeName(String name) {
        return name.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    /** Only approved whole-model aliases share work; configuration names remain untouched. */
    private static String normalizeModel(String brand, String model) {
        String normalized = normalizeName(model);
        if (normalizeName(brand).equals("ford") && Set.of("f150", "f-150").contains(normalized)) return "f-150";
        return normalized;
    }

    /** Query order, escapes and path case may carry meaning and are deliberately preserved. */
    public static String normalizeUrl(String value) {
        var uri = URI.create(value);
        String port = uri.getPort() == -1 || uri.getPort() == 443 ? "" : ":" + uri.getPort();
        String path = uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
        return "https://" + uri.getHost().toLowerCase(Locale.ROOT) + port + path
                + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
    }

    public record Scope(
            String sourceUrl, String brand, String model, String market, int modelYear, String policyVersion)
            implements ValueObject {
        public static Scope of(Ingestion.Request request, String policyVersion) {
            require(request != null, "A research request is required");
            require(
                    policyVersion != null && policyVersion.matches("[a-zA-Z0-9._-]{1,100}"),
                    "Invalid research policy version");
            return new Scope(
                    normalizeUrl(request.sourceUrl()),
                    normalizeName(request.brand()),
                    normalizeModel(request.brand(), request.model()),
                    request.market(),
                    request.modelYear(),
                    policyVersion);
        }
    }

    public record Source(
            String url, String title, String mimeType, String originalSha256, String textSha256, String parserVersion)
            implements ValueObject {
        public static Source from(Ingestion.Source source) {
            return source == null
                    ? null
                    : new Source(
                            source.url(),
                            source.title(),
                            source.mimeType(),
                            source.originalSha256(),
                            source.textSha256(),
                            source.parserVersion());
        }
    }

    public record Snapshot(
            UUID id,
            UUID workId,
            String requestStatus,
            String disposition,
            Ingestion.Request request,
            String status,
            int attempts,
            String stage,
            List<Ingestion.ConfigurationDraft> configurations,
            List<String> warnings,
            String error,
            Source source,
            Map<String, UUID> configurationIds,
            Instant createdAt,
            Instant updatedAt,
            long ontologyRevision,
            String normalizationRevision,
            UUID replayedFromWorkId)
            implements ValueObject {
        public Snapshot(
                UUID id,
                UUID workId,
                String requestStatus,
                String disposition,
                Ingestion.Request request,
                String status,
                int attempts,
                String stage,
                List<Ingestion.ConfigurationDraft> configurations,
                List<String> warnings,
                String error,
                Source source,
                Map<String, UUID> configurationIds,
                Instant createdAt,
                Instant updatedAt) {
            this(
                    id,
                    workId,
                    requestStatus,
                    disposition,
                    request,
                    status,
                    attempts,
                    stage,
                    configurations,
                    warnings,
                    error,
                    source,
                    configurationIds,
                    createdAt,
                    updatedAt,
                    0,
                    null,
                    null);
        }
    }

    /** History metadata; opening a private request separately loads its source and claims. */
    public record Summary(
            UUID id,
            UUID workId,
            String requestStatus,
            String disposition,
            Ingestion.Request request,
            String status,
            int attempts,
            String stage,
            Instant createdAt,
            Instant updatedAt)
            implements ValueObject {}

    public record Checkpoint(String key, String payload) implements ValueObject {
        public Checkpoint {
            require(key != null && key.matches("[a-z0-9-]{1,100}"), "Invalid checkpoint key");
            require(
                    payload != null
                            && !payload.isBlank()
                            && payload.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 12_000_000,
                    "Checkpoint payload must be at most 12 MB");
        }
    }
}
