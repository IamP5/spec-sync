package com.fiap.ford.specsync.application.research.impl;

import com.fiap.ford.specsync.application.research.GetResearch;
import com.fiap.ford.specsync.domain.research.Research;
import com.fiap.ford.specsync.domain.research.ResearchGateway;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultGetResearch extends GetResearch {
    private final ResearchGateway gateway;

    public DefaultGetResearch(ResearchGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.get(input.id(), input.uid()));
    }

    record StdOutput(Research.Snapshot result) implements Output {}
}
