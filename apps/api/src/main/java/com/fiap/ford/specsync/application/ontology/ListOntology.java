package com.fiap.ford.specsync.application.ontology;

import com.fiap.ford.specsync.application.NullaryUseCase;
import com.fiap.ford.specsync.domain.ontology.Ontology;

public abstract class ListOntology extends NullaryUseCase<ListOntology.Output> {
    public interface Output {
        Ontology.Overview result();
    }
}
