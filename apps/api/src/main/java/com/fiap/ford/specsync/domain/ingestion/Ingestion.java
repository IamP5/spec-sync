package com.fiap.ford.specsync.domain.ingestion;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.ontology.Ontology;
import com.fiap.ford.specsync.domain.shared.ValueObject;
import com.fiap.ford.specsync.domain.validation.Error;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.util.*;

/**
 * Reviewed specification imports. One run captures one official source and proposes claims for one
 * or more vehicle configurations found in it (a brochure usually lists every trim of a model).
 * Nothing reaches the catalog before a curator confirms identity and selects claims.
 */
public final class Ingestion {
    private Ingestion() {}

    /** Upper bound of configurations one source run may propose or publish. */
    public static final int MAX_CONFIGURATIONS = 8;

    /** Upper bound of claims per configuration in one run. */
    public static final int MAX_CLAIMS = 100;

    public static void require(boolean valid, String message) {
        if (!valid) throw DomainException.with(new Error("ingestion", message));
    }

    /**
     * Scope of a run. {@code configurations} names the trims to import; an empty list asks the
     * extractor to propose every configuration the source presents for this model and year.
     */
    public record Request(
            String sourceUrl, String brand, String model, String market, int modelYear, List<String> configurations)
            implements ValueObject {
        public Request {
            require(sourceUrl != null && sourceUrl.length() <= 2000, "A source URL is required");
            URI uri;
            try {
                uri = URI.create(sourceUrl);
            } catch (IllegalArgumentException e) {
                throw DomainException.with(new Error("sourceUrl", "Invalid URL"));
            }
            require(
                    "https".equals(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null,
                    "Use an HTTPS source URL");
            for (String value : Arrays.asList(brand, model))
                require(
                        value != null && !value.isBlank() && value.length() <= 150,
                        "Brand and model are required (maximum 150 characters)");
            require("BR".equals(market), "This ingestion version supports market BR");
            require(modelYear >= 1900 && modelYear <= 2200, "An explicit model year is required");
            configurations = configurations == null ? List.of() : List.copyOf(configurations);
            require(
                    configurations.size() <= MAX_CONFIGURATIONS,
                    "Import at most " + MAX_CONFIGURATIONS + " configurations per source");
            var names = new HashSet<String>();
            for (String name : configurations) {
                require(
                        name != null && !name.isBlank() && name.length() <= 150,
                        "Configuration names must be between 1 and 150 characters");
                require(names.add(name.trim().toLowerCase(Locale.ROOT)), "Duplicate configuration name");
            }
        }
    }

    public record CapturedFile(byte[] bytes, String mimeType) implements ValueObject {}

    public record Source(
            String url,
            String title,
            String mimeType,
            String originalBase64,
            String originalSha256,
            String text,
            String textSha256,
            String parserVersion)
            implements ValueObject {}

    public record Claim(
            String attributeCode,
            String label,
            String unit,
            String rawValue,
            String rawUnit,
            String availability,
            List<String> listValue,
            Map<String, String> qualifiers,
            int lineStart,
            int lineEnd,
            String excerpt,
            String locator,
            Object value,
            List<String> issues,
            String originalTerm)
            implements ValueObject {
        public Claim(
                String attributeCode,
                String label,
                String unit,
                String rawValue,
                String rawUnit,
                String availability,
                List<String> listValue,
                Map<String, String> qualifiers,
                int lineStart,
                int lineEnd,
                String excerpt,
                String locator,
                Object value,
                List<String> issues) {
            this(
                    attributeCode,
                    label,
                    unit,
                    rawValue,
                    rawUnit,
                    availability,
                    listValue,
                    qualifiers,
                    lineStart,
                    lineEnd,
                    excerpt,
                    locator,
                    value,
                    issues,
                    null);
        }
    }

    /** Claims proposed for one configuration, with the evidence establishing its identity. */
    public record ConfigurationDraft(
            String name,
            int identityLineStart,
            int identityLineEnd,
            String identityExcerpt,
            List<Claim> claims,
            List<String> warnings,
            List<Ontology.Observation> unmappedObservations)
            implements ValueObject {
        public ConfigurationDraft {
            unmappedObservations = unmappedObservations == null ? List.of() : List.copyOf(unmappedObservations);
        }

        public ConfigurationDraft(
                String name,
                int identityLineStart,
                int identityLineEnd,
                String identityExcerpt,
                List<Claim> claims,
                List<String> warnings) {
            this(name, identityLineStart, identityLineEnd, identityExcerpt, claims, warnings, List.of());
        }
    }

    /** Everything the extractor proposed for one source; {@code warnings} is the coverage report. */
    public record Draft(
            Source source,
            List<ConfigurationDraft> configurations,
            List<String> warnings,
            Long ontologyRevision,
            String normalizationRevision,
            String readerRevision)
            implements ValueObject {
        public Draft {
            ontologyRevision = ontologyRevision == null ? 0L : ontologyRevision;
        }

        public Draft(Source source, List<ConfigurationDraft> configurations, List<String> warnings) {
            this(source, configurations, warnings, 0L, null, null);
        }
    }

    public record Run(
            UUID id,
            Request request,
            String status,
            int attempts,
            Draft draft,
            String draftHash,
            long baseRevision,
            Map<String, UUID> configurationIds,
            String error,
            String projectionStatus,
            String projectionError,
            Map<String, Map<String, Object>> currentValues,
            Instant createdAt,
            Instant updatedAt)
            implements ValueObject {}

    /** List entry of a curator's runs; the draft itself is loaded per run. */
    public record Summary(
            UUID id,
            Request request,
            String status,
            int configurations,
            int claims,
            String error,
            Instant createdAt,
            Instant updatedAt)
            implements ValueObject {}

    public record Work(
            UUID id, UUID leaseToken, Request request, String researchPolicyVersion, Ontology.Context ontology)
            implements ValueObject {
        public Work(UUID id, UUID leaseToken, Request request, String researchPolicyVersion) {
            this(id, leaseToken, request, researchPolicyVersion, null);
        }

        public Work(UUID id, UUID leaseToken, Request request) {
            this(id, leaseToken, request, null);
        }
    }

    public record Projection(UUID leaseToken, long revision, String snapshot) implements ValueObject {}

    /** Decision for one configuration of the draft, addressed by its index. */
    public record ConfigurationReview(int configuration, List<Integer> selectedClaims, boolean identityConfirmed)
            implements ValueObject {
        public ConfigurationReview {
            require(configuration >= 0 && configuration < MAX_CONFIGURATIONS, "Unknown configuration selection");
            selectedClaims = selectedClaims == null ? List.of() : List.copyOf(selectedClaims);
            require(selectedClaims.size() <= MAX_CLAIMS, "Select at most " + MAX_CLAIMS + " claims per configuration");
            require(new HashSet<>(selectedClaims).size() == selectedClaims.size(), "Duplicate claim selection");
            require(
                    selectedClaims.isEmpty() || identityConfirmed,
                    "Confirm the source applies to this exact vehicle identity before publishing its claims");
        }
    }

    public record Review(String draftHash, long baseRevision, List<ConfigurationReview> configurations, String reason)
            implements ValueObject {
        public Review {
            require(draftHash != null && draftHash.matches("[0-9a-f]{64}"), "An exact draft revision is required");
            require(
                    configurations != null && !configurations.isEmpty() && configurations.size() <= MAX_CONFIGURATIONS,
                    "Review between 1 and " + MAX_CONFIGURATIONS + " configurations");
            configurations = List.copyOf(configurations);
            var indexes = new HashSet<Integer>();
            int selected = 0;
            for (var review : configurations) {
                require(indexes.add(review.configuration()), "Duplicate configuration review");
                selected += review.selectedClaims().size();
            }
            require(selected > 0, "Select at least one claim to publish");
            require(reason != null && !reason.isBlank() && reason.length() <= 2000, "A review reason is required");
        }
    }

    /**
     * Parses a Brazilian-market scalar and converts it to the attribute's canonical unit. Grouping
     * dots with a decimal comma ({@code 1.200,5}) and plain thousands grouping ({@code 3.270}) are
     * the source locale; a lone dot with one or two decimals ({@code 2.5}) is a decimal point. Ranges,
     * words and other notations stay for review.
     */
    public static BigDecimal normalizeNumber(String raw, String originalUnit, String canonicalUnit) {
        require(raw != null, "Numeric values must be unambiguous scalars; ranges and grouping need review");
        String scalar = raw.trim().replace(" ", "").replace("\u00a0", "");
        BigDecimal number;
        if (scalar.matches("[+-]?[0-9]+")) number = new BigDecimal(scalar);
        else if (scalar.matches("[+-]?[0-9]{1,3}(\\.[0-9]{3})+,[0-9]+"))
            number = new BigDecimal(scalar.replace(".", "").replace(',', '.'));
        else if (scalar.matches("[+-]?[0-9]{1,3}(\\.[0-9]{3})+")) number = new BigDecimal(scalar.replace(".", ""));
        else if (scalar.matches("[+-]?[0-9]+,[0-9]+")) number = new BigDecimal(scalar.replace(',', '.'));
        else if (scalar.matches("[+-]?[0-9]+\\.[0-9]{1,2}")) number = new BigDecimal(scalar);
        else {
            require(false, "Numeric values must be unambiguous scalars; ranges and grouping need review");
            return null;
        }
        String from = unitKey(originalUnit), to = unitKey(canonicalUnit);
        if (from.equals(to)) return number;
        if (to.equals("nm") && Set.of("kgf.m", "kgfm", "kgf m", "mkgf", "kgm").contains(from))
            return number.multiply(new BigDecimal("9.80665"));
        Map<String, BigDecimal> power = Map.of(
                "kw", BigDecimal.ONE, "cv", new BigDecimal("0.73549875"), "hp", new BigDecimal("0.74569987158227022"));
        if (power.containsKey(from) && power.containsKey(to))
            return number.multiply(power.get(from))
                    .divide(power.get(to), 12, java.math.RoundingMode.HALF_UP)
                    .stripTrailingZeros();
        Map<String, BigDecimal> length =
                Map.of("mm", BigDecimal.ONE, "cm", BigDecimal.TEN, "m", new BigDecimal("1000"));
        if (length.containsKey(from) && length.containsKey(to))
            return number.multiply(length.get(from)).divide(length.get(to));
        require(false, "Unsupported or missing unit conversion: " + from + " to " + to);
        return number;
    }

    /** Lower-cased unit spelling shared by the conversion table and manufacturer notation. */
    private static String unitKey(String unit) {
        String key = Objects.toString(unit, "")
                .trim()
                .toLowerCase(Locale.ROOT)
                .replace("·", ".")
                .replace("³", "3")
                .replace("r$", "brl");
        return switch (key) {
            case "litros", "litro", "lt", "lts" -> "l";
            case "cc", "cm³", "cm 3" -> "cm3";
            case "n.m", "n m" -> "nm";
            case "kgs", "kilogramas" -> "kg";
            default -> key;
        };
    }

    public static boolean exactExcerpt(String text, int start, int end, String excerpt) {
        if (text == null || excerpt == null || excerpt.isBlank()) return false;
        String[] lines = text.split("\n", -1);
        return start > 0
                && end >= start
                && end <= lines.length
                && String.join("\n", Arrays.copyOfRange(lines, start - 1, end)).equals(excerpt);
    }
}
