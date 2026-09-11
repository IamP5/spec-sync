package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.domain.ontology.Ontology;
import java.util.List;

public record OntologyResponse(
        long revision, long projectedRevision, String projectionError, List<Ontology.Proposal> proposals) {
    public static OntologyResponse from(Ontology.Overview result) {
        return new OntologyResponse(
                result.revision(), result.projectedRevision(), result.projectionError(), result.proposals());
    }
}
