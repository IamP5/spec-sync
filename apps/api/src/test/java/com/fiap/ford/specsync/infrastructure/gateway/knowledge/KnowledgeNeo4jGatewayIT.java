package com.fiap.ford.specsync.infrastructure.gateway.knowledge;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.domain.knowledge.*;
import com.fiap.ford.specsync.infrastructure.configuration.KnowledgeProperties;
import org.junit.jupiter.api.Test;

class KnowledgeNeo4jGatewayIT {
    @Test
    void distinguishesMissingServiceFromMissingEvidence() {
        var gateway = new KnowledgeNeo4jGateway(new KnowledgeProperties("", "", "", null));
        var result = gateway.retrieve(
                new KnowledgeQuery(KnowledgeQuery.Kind.REVIEWS, "ride", null, null, null, null, true, 10, null));
        assertEquals("UNAVAILABLE", result.status());
        assertTrue(result.items().isEmpty());
    }
}
