package com.fiap.ford.specsync.domain.knowledge;

import com.fiap.ford.specsync.domain.shared.AssertionConcern;
import com.fiap.ford.specsync.domain.shared.ValueObject;
import java.util.List;
import java.util.UUID;

public record KnowledgeQuery(
        Kind kind,
        String query,
        UUID configurationId,
        String attributeCode,
        String market,
        Integer modelYear,
        boolean includeOptional,
        int limit,
        List<Double> embedding)
        implements ValueObject, AssertionConcern {
    public enum Kind {
        CONCEPTS,
        CAPABILITIES,
        REVIEWS,
        RELATED_REVIEWS,
        EVIDENCE
    }

    public KnowledgeQuery {
        assertConditionTrue(kind != null, "kind", "Operation is required.");
        query = query == null ? "" : query.strip();
        assertConditionTrue(query.length() <= 500, "q", "Query is too long.");
        assertConditionTrue(limit >= 1 && limit <= 30, "limit", "Limit must be between 1 and 30.");
        assertConditionTrue(
                attributeCode == null || attributeCode.matches("[a-z][a-z0-9_]{0,79}"),
                "attributeCode",
                "Invalid attribute code.");
        assertConditionTrue(market == null || market.matches("[A-Z]{2}"), "market", "Invalid market.");
        assertConditionTrue(modelYear == null || modelYear >= 1900 && modelYear <= 2200, "modelYear", "Invalid year.");
        assertConditionTrue(
                kind != Kind.CAPABILITIES || attributeCode != null,
                "attributeCode",
                "A resolved attribute is required.");
        assertConditionTrue(
                kind != Kind.RELATED_REVIEWS || configurationId != null && attributeCode != null,
                "configurationId",
                "Related reviews require configuration and attribute.");
        embedding = embedding == null ? List.of() : List.copyOf(embedding);
        assertConditionTrue(
                embedding.size() <= 4096 && embedding.stream().allMatch(v -> v != null && Double.isFinite(v)),
                "embedding",
                "Invalid query embedding.");
        if (kind == Kind.EVIDENCE) {
            boolean valid;
            try {
                UUID.fromString(query);
                valid = true;
            } catch (IllegalArgumentException e) {
                valid = false;
            }
            assertConditionTrue(valid, "q", "Evidence ID must be a UUID.");
        }
    }
}
