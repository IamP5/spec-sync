package com.fiap.ford.specsync.web.controllers;

import com.fiap.ford.specsync.application.knowledge.RetrieveKnowledge;
import com.fiap.ford.specsync.domain.knowledge.KnowledgeQuery;
import com.fiap.ford.specsync.domain.knowledge.KnowledgeQuery.Kind;
import com.fiap.ford.specsync.web.api.KnowledgeApi;
import com.fiap.ford.specsync.web.dto.response.KnowledgeResponse;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class KnowledgeController implements KnowledgeApi {
    public KnowledgeResponse semanticReviews(com.fiap.ford.specsync.web.dto.request.ReviewSearchRequest request) {
        return reviews(
                request.q(),
                request.configurationId(),
                request.attributeCode(),
                request.limit() == null ? 10 : request.limit(),
                request.embedding());
    }

    private final RetrieveKnowledge useCase;

    public KnowledgeController(RetrieveKnowledge useCase) {
        this.useCase = Objects.requireNonNull(useCase);
    }

    private KnowledgeResponse run(
            Kind kind,
            String q,
            UUID id,
            String attr,
            String market,
            Integer year,
            boolean optional,
            int limit,
            List<Double> vector) {
        return useCase.execute(
                new RetrieveKnowledge.Input(
                        new KnowledgeQuery(kind, q, id, attr, market, year, optional, limit, vector)),
                KnowledgeResponse::from);
    }

    public KnowledgeResponse concepts(String q, int limit) {
        return run(Kind.CONCEPTS, q, null, null, null, null, true, limit, null);
    }

    public KnowledgeResponse capabilities(String attr, String market, Integer year, boolean optional, int limit) {
        return run(Kind.CAPABILITIES, "", null, attr, market, year, optional, limit, null);
    }

    public KnowledgeResponse reviews(String q, UUID id, String attr, int limit, List<Double> vector) {
        return run(Kind.REVIEWS, q, id, attr, null, null, true, limit, vector);
    }

    public KnowledgeResponse related(UUID id, String attr, int limit) {
        return run(Kind.RELATED_REVIEWS, "", id, attr, null, null, true, limit, null);
    }

    public KnowledgeResponse evidence(UUID id) {
        return run(Kind.EVIDENCE, id.toString(), null, null, null, null, true, 1, null);
    }
}
