package com.fiap.ford.specsync.application.research.impl;

import com.fiap.ford.specsync.application.research.HeartbeatResearch;
import com.fiap.ford.specsync.domain.research.ResearchGateway;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultHeartbeatResearch extends HeartbeatResearch {
    private final ResearchGateway gateway;

    public DefaultHeartbeatResearch(ResearchGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public void execute(Input input) {
        gateway.heartbeat(input.workId(), input.attemptId());
    }
}
