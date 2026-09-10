package com.fiap.ford.specsync.application.ontology.impl;

import com.fiap.ford.specsync.application.ontology.ActivateOntology;
import com.fiap.ford.specsync.domain.ontology.OntologyGateway;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultActivateOntology extends ActivateOntology {
    private final OntologyGateway gateway;

    public DefaultActivateOntology(OntologyGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        var result = gateway.activate(input.id(), input.reviewer(), input.decision());
        return () -> result;
    }
}
