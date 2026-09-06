package com.fiap.ford.specsync.application.knowledge.impl;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.application.knowledge.RetrieveKnowledge;
import com.fiap.ford.specsync.domain.knowledge.*;
import java.util.List;
import org.junit.jupiter.api.Test;

class DefaultRetrieveKnowledgeTest {
    @Test
    void preservesUnavailableStateWithoutInventingEvidence() {
        var query = new KnowledgeQuery(KnowledgeQuery.Kind.REVIEWS, "ride", null, null, null, null, true, 10, null);
        var useCase = new DefaultRetrieveKnowledge(q -> {
            assertEquals(query, q);
            return new KnowledgeResult("UNAVAILABLE", "Offline", null, List.of());
        });
        assertEquals(
                "UNAVAILABLE",
                useCase.execute(new RetrieveKnowledge.Input(query)).result().status());
    }
}
