package com.fiap.ford.specsync.application.ontology;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.ontology.Ontology;
import java.util.UUID;

public abstract class ActivateOntology extends UseCase<ActivateOntology.Input, ActivateOntology.Output> {
    public record Input(UUID id, String reviewer, Ontology.Decision decision) {}

    public interface Output {
        Ontology.Overview result();
    }
}
