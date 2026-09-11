package com.fiap.ford.specsync.application.research.impl;

import com.fiap.ford.specsync.application.research.ResolveResearchReview;
import com.fiap.ford.specsync.domain.research.Research;
import com.fiap.ford.specsync.domain.research.ResearchGateway;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class DefaultResolveResearchReview extends ResolveResearchReview {
    private final ResearchGateway gateway;

    public DefaultResolveResearchReview(ResearchGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        var research = gateway.get(input.id(), input.uid());
        Research.require("ACTIVE".equals(research.requestStatus()), "Research request is no longer active");
        return new StdOutput(research.workId());
    }

    record StdOutput(UUID workId) implements Output {}
}
