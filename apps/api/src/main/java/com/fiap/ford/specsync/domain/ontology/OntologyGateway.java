package com.fiap.ford.specsync.domain.ontology;

import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import java.util.UUID;

public interface OntologyGateway {
    Ontology.Context context();

    void observe(Ingestion.Work work, Ingestion.Draft draft);

    Ontology.Overview list();

    Ontology.Overview activate(UUID id, String reviewer, Ontology.Decision decision);
}
