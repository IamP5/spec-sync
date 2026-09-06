package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.knowledge.RetrieveKnowledge;
import java.util.List;
import java.util.Map;

public record KnowledgeResponse(
        String status, String message, String projectionVersion, List<Map<String, Object>> items) {
    public static KnowledgeResponse from(RetrieveKnowledge.Output output) {
        var r = output.result();
        return new KnowledgeResponse(r.status(), r.message(), r.projectionVersion(), r.items());
    }
}
