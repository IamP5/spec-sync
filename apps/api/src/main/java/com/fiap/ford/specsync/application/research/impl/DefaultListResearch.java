package com.fiap.ford.specsync.application.research.impl;

import com.fiap.ford.specsync.application.research.ListResearch;
import com.fiap.ford.specsync.domain.research.Research;
import com.fiap.ford.specsync.domain.research.ResearchGateway;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultListResearch extends ListResearch {
    private final ResearchGateway gateway;

    public DefaultListResearch(ResearchGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.list(input.uid()));
    }

    record StdOutput(java.util.List<Research.Summary> result) implements Output {}
}
