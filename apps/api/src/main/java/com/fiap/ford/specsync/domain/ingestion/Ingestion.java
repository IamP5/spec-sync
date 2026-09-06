package com.fiap.ford.specsync.domain.ingestion;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.shared.ValueObject;
import com.fiap.ford.specsync.domain.validation.Error;
import java.math.BigDecimal;
import java.net.URI;
import java.util.*;

public final class Ingestion {
    private Ingestion() {}

    public static void require(boolean valid, String message) {
        if (!valid) throw DomainException.with(new Error("ingestion", message));
    }

    public record Request(
            String sourceUrl,
            String brand,
            String model,
            String name,
            String market,
            int modelYear,
            UUID configurationId)
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
            for (String value : Arrays.asList(brand, model, name))
                require(
                        value != null && !value.isBlank() && value.length() <= 150,
                        "Brand, model and configuration name are required (maximum 150 characters)");
            require("BR".equals(market), "This ingestion version supports market BR");
            require(modelYear >= 1900 && modelYear <= 2200, "An explicit model year is required");
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
            List<String> issues)
            implements ValueObject {}

    public record Draft(
            Source source, int identityLineStart, int identityLineEnd, String identityExcerpt, List<Claim> claims)
            implements ValueObject {}

    public record Run(
            UUID id,
            Request request,
            String status,
            int attempts,
            Draft draft,
            String draftHash,
            long baseRevision,
            UUID configurationId,
            String error,
            String projectionStatus,
            String projectionError,
            Map<String, Object> currentValues)
            implements ValueObject {}

    public record Work(UUID id, UUID leaseToken, Request request) implements ValueObject {}

    public record Projection(UUID leaseToken, long revision, String snapshot) implements ValueObject {}

    public record Review(
            String draftHash, long baseRevision, List<Integer> selectedClaims, boolean identityConfirmed, String reason)
            implements ValueObject {
        public Review {
            require(draftHash != null && draftHash.matches("[0-9a-f]{64}"), "An exact draft revision is required");
            require(
                    selectedClaims != null && !selectedClaims.isEmpty() && selectedClaims.size() <= 100,
                    "Select between 1 and 100 claims");
            selectedClaims = List.copyOf(selectedClaims);
            require(new HashSet<>(selectedClaims).size() == selectedClaims.size(), "Duplicate claim selection");
            require(identityConfirmed, "Confirm the source applies to this exact vehicle identity");
            require(reason != null && !reason.isBlank() && reason.length() <= 2000, "A review reason is required");
        }
    }

    public static BigDecimal normalizeNumber(String raw, String originalUnit, String canonicalUnit) {
        require(
                raw != null && raw.trim().matches("[+-]?[0-9]+([.,][0-9]+)?"),
                "Numeric values must be unambiguous scalars; ranges and grouping need review");
        BigDecimal number = new BigDecimal(raw.trim().replace(',', '.'));
        String from = Objects.toString(originalUnit, "")
                .trim()
                .toLowerCase(Locale.ROOT)
                .replace("·", ".");
        String to = Objects.toString(canonicalUnit, "").trim().toLowerCase(Locale.ROOT);
        if (from.equals(to)) return number;
        if (to.equals("nm") && Set.of("kgf.m", "kgfm", "kgf m").contains(from))
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

    public static boolean exactExcerpt(String text, int start, int end, String excerpt) {
        if (text == null || excerpt == null || excerpt.isBlank()) return false;
        String[] lines = text.split("\n", -1);
        return start > 0
                && end >= start
                && end <= lines.length
                && String.join("\n", Arrays.copyOfRange(lines, start - 1, end)).equals(excerpt);
    }
}
