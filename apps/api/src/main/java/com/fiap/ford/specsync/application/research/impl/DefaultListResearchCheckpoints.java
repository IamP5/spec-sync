package com.fiap.ford.specsync.application.research.impl;

import com.fiap.ford.specsync.application.research.ListResearchCheckpoints;
import com.fiap.ford.specsync.domain.research.Research;
import com.fiap.ford.specsync.domain.research.ResearchGateway;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultListResearchCheckpoints extends ListResearchCheckpoints {
    private final ResearchGateway gateway;

    public DefaultListResearchCheckpoints(ResearchGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.checkpoints(input.workId(), input.attemptId()));
    }

    record StdOutput(java.util.List<Research.Checkpoint> result) implements Output {}
}
