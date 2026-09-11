package com.fiap.ford.specsync.application.research.impl;

import com.fiap.ford.specsync.application.research.SaveResearchCheckpoint;
import com.fiap.ford.specsync.domain.research.ResearchGateway;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultSaveResearchCheckpoint extends SaveResearchCheckpoint {
    private final ResearchGateway gateway;

    public DefaultSaveResearchCheckpoint(ResearchGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public void execute(Input input) {
        gateway.checkpoint(input.workId(), input.attemptId(), input.checkpoint());
    }
}
