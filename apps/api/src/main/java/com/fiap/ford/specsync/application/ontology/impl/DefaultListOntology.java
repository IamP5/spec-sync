package com.fiap.ford.specsync.application.ontology.impl;

import com.fiap.ford.specsync.application.ontology.ListOntology;
import com.fiap.ford.specsync.domain.ontology.OntologyGateway;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultListOntology extends ListOntology {
    private final OntologyGateway gateway;

    public DefaultListOntology(OntologyGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute() {
        var result = gateway.list();
        return () -> result;
    }
}
