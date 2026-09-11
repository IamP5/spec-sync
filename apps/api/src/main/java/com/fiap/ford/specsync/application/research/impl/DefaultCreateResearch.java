package com.fiap.ford.specsync.application.research.impl;

import com.fiap.ford.specsync.application.research.CreateResearch;
import com.fiap.ford.specsync.domain.research.Research;
import com.fiap.ford.specsync.domain.research.ResearchGateway;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultCreateResearch extends CreateResearch {
    private final ResearchGateway gateway;

    public DefaultCreateResearch(ResearchGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.create(input.id(), input.uid(), input.request()));
    }

    record StdOutput(Research.Snapshot result) implements Output {}
}
