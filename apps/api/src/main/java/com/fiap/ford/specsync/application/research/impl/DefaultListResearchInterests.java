package com.fiap.ford.specsync.application.research.impl;

import com.fiap.ford.specsync.application.research.ListResearchInterests;
import com.fiap.ford.specsync.domain.research.Research;
import com.fiap.ford.specsync.domain.research.ResearchInterestGateway;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultListResearchInterests extends ListResearchInterests {
    private final ResearchInterestGateway gateway;

    public DefaultListResearchInterests(ResearchInterestGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        Research.requireIdentity(input.id(), input.uid());
        var result = gateway.list(input.id(), input.uid());
        return () -> result;
    }
}
