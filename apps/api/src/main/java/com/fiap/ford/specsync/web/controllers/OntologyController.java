package com.fiap.ford.specsync.web.controllers;

import com.fiap.ford.specsync.application.ontology.*;
import com.fiap.ford.specsync.domain.ontology.Ontology;
import com.fiap.ford.specsync.web.api.OntologyApi;
import com.fiap.ford.specsync.web.dto.request.ActivateOntologyRequest;
import com.fiap.ford.specsync.web.dto.response.OntologyResponse;
import java.security.Principal;
import java.util.*;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class OntologyController implements OntologyApi {
    private final ListOntology list;
    private final ActivateOntology activate;

    public OntologyController(ListOntology list, ActivateOntology activate) {
        this.list = Objects.requireNonNull(list);
        this.activate = Objects.requireNonNull(activate);
    }

    @Override
    public OntologyResponse list() {
        return list.execute(output -> OntologyResponse.from(output.result()));
    }

    @Override
    public OntologyResponse activate(UUID id, ActivateOntologyRequest request, Principal principal) {
        return activate.execute(
                new ActivateOntology.Input(
                        id, principal.getName(), new Ontology.Decision(request.baseRevision(), request.reason())),
                output -> OntologyResponse.from(output.result()));
    }
}
