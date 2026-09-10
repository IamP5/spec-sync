package com.fiap.ford.specsync.application.research.impl;

import com.fiap.ford.specsync.application.research.ReplayResearch;
import com.fiap.ford.specsync.domain.research.ResearchGateway;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultReplayResearch extends ReplayResearch {
    private final ResearchGateway gateway;

    public DefaultReplayResearch(ResearchGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        var result = gateway.replay(input.id(), input.uid(), input.newId());
        return () -> result;
    }
}
