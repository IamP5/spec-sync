package com.fiap.ford.specsync.domain.ontology;

import com.fiap.ford.specsync.domain.catalog.Catalog;
import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import com.fiap.ford.specsync.domain.shared.ValueObject;
import java.text.Normalizer;
import java.util.*;

/** Stable catalog meanings and separately evidenced manufacturer terminology. */
public final class Ontology {
    private Ontology() {}

    public static final String NORMALIZATION_REVISION = "numeric-v3";

    public static String key(String value) {
        return Normalizer.normalize(Objects.toString(value, ""), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .strip()
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ");
    }

    public static boolean retainsOriginalTerms(String parserVersion) {
        return Objects.toString(parserVersion, "").matches("specsync-visual-pdf-evidence-v[56]:.+");
    }

    public static String originalTerm(Ingestion.Source source, String excerpt, String term) {
        if (term == null || excerpt == null || !excerpt.contains(term)) return null;
        if ("application/pdf".equals(source.mimeType())
                && !(retainsOriginalTerms(source.parserVersion()) && excerpt.contains("originalTerm: " + term)))
            return null;
        return term;
    }

    public static String modelKey(String brand, String model) {
        String normalized = key(model);
        if (key(brand).equals("ford") && normalized.matches("f-?\\d{3}"))
            return "f-" + normalized.replaceAll("[^0-9]", "");
        if (key(brand).equals("ram") && normalized.matches("ram ?[0-9]{4}"))
            return normalized.replaceFirst("ram ?", "");
        return normalized;
    }

    public record Term(
            String attributeCode,
            String term,
            String brand,
            String model,
            String market,
            String language,
            Integer modelYear)
            implements ValueObject {}

    public record AttributeValue(String attributeCode, String code, List<String> aliases) implements ValueObject {}

    public record Context(
            long ontologyRevision,
            String normalizationRevision,
            List<Catalog.Attribute> attributes,
            List<Term> terminology,
            List<AttributeValue> attributeValues)
            implements ValueObject {
        public Context {
            attributes = attributes == null ? List.of() : List.copyOf(attributes);
            terminology = terminology == null ? List.of() : List.copyOf(terminology);
            attributeValues = attributeValues == null ? List.of() : List.copyOf(attributeValues);
        }
    }

    public static List<String> normalizeVocabulary(Context context, String attributeCode, List<String> values) {
        var vocabulary = context.attributeValues().stream()
                .filter(v -> v.attributeCode().equals(attributeCode))
                .toList();
        if (vocabulary.isEmpty()) return values;
        var result = new LinkedHashSet<String>();
        for (String value : values) {
            var matched = vocabulary.stream()
                    .filter(v -> key(v.code()).equals(key(value))
                            || v.aliases().stream().anyMatch(a -> key(a).equals(key(value))))
                    .map(AttributeValue::code)
                    .distinct()
                    .toList();
            Ingestion.require(matched.size() == 1, "Unknown or ambiguous vocabulary requires an ontology proposal");
            result.add(matched.getFirst());
        }
        return List.copyOf(result);
    }

    public record Candidate(
            String kind,
            String attributeCode,
            String proposedCode,
            String label,
            String definition,
            String valueType,
            String unit,
            String dimension,
            List<String> alternatives)
            implements ValueObject {}

    public record Observation(
            String originalTerm,
            String rawValue,
            String sourceUnit,
            Map<String, String> qualifiers,
            int lineStart,
            int lineEnd,
            String excerpt,
            String locator,
            Candidate proposal,
            String termOrigin)
            implements ValueObject {}

    public record Proposal(
            UUID id,
            String kind,
            String status,
            String term,
            String brand,
            String model,
            String market,
            int modelYear,
            Candidate candidate,
            long baseRevision,
            Long activatedRevision,
            int evidenceCount,
            String reason)
            implements ValueObject {}

    public record Overview(long revision, long projectedRevision, String projectionError, List<Proposal> proposals)
            implements ValueObject {}

    public record Decision(long baseRevision, String reason) implements ValueObject {
        public Decision {
            Ingestion.require(
                    reason != null && !reason.isBlank() && reason.length() <= 2000,
                    "An ontology review reason is required");
        }
    }
    /** Exact scoped lookup never infers equivalence from units or spelling similarity. */
    public static Optional<String> resolve(Context context, Ingestion.Request request, Observation observation) {
        var matches = context.terminology().stream()
                .filter(t -> key(t.term()).equals(key(observation.originalTerm())))
                .filter(t -> t.brand() == null || key(t.brand()).equals(key(request.brand())))
                .filter(t -> t.market() == null || t.market().equals(request.market()))
                .filter(t -> t.model() == null
                        || modelKey(request.brand(), t.model()).equals(modelKey(request.brand(), request.model())))
                .filter(t -> t.modelYear() == null || t.modelYear() == request.modelYear())
                .map(Term::attributeCode)
                .distinct()
                .toList();
        return matches.size() == 1 ? Optional.of(matches.getFirst()) : Optional.empty();
    }
}
