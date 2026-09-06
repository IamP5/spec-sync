package com.fiap.ford.specsync.application.knowledge.impl;

import com.fiap.ford.specsync.application.knowledge.RetrieveKnowledge;
import com.fiap.ford.specsync.domain.knowledge.*;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultRetrieveKnowledge extends RetrieveKnowledge {
    private final KnowledgeGateway gateway;

    public DefaultRetrieveKnowledge(KnowledgeGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    public Output execute(Input input) {
        return new StdOutput(gateway.retrieve(input.query()));
    }

    record StdOutput(KnowledgeResult result) implements Output {}
}
