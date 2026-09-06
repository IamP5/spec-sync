package com.fiap.ford.specsync.domain.knowledge;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import java.util.List;
import org.junit.jupiter.api.Test;

class KnowledgeQueryTest {
    @Test
    void requiresResolvedAttributeForCapabilityDiscovery() {
        assertThrows(
                DomainException.class,
                () -> new KnowledgeQuery(KnowledgeQuery.Kind.CAPABILITIES, "", null, null, null, null, true, 10, null));
    }

    @Test
    void rejectsUnboundedResults() {
        assertThrows(
                DomainException.class,
                () -> new KnowledgeQuery(KnowledgeQuery.Kind.REVIEWS, "", null, null, null, null, true, 100, null));
    }

    @Test
    void rejectsInvalidVectors() {
        assertThrows(
                DomainException.class,
                () -> new KnowledgeQuery(
                        KnowledgeQuery.Kind.REVIEWS, "ride", null, null, null, null, true, 10, List.of(Double.NaN)));
    }

    @Test
    void preservesLiteralSearchText() {
        assertEquals(
                "x' DELETE",
                new KnowledgeQuery(KnowledgeQuery.Kind.CONCEPTS, " x' DELETE ", null, null, null, null, true, 10, null)
                        .query());
    }
}
