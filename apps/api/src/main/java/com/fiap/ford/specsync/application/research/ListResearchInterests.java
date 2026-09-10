package com.fiap.ford.specsync.application.research;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.research.ResearchInterestGateway;
import java.util.UUID;

public abstract class ListResearchInterests extends UseCase<ListResearchInterests.Input, ListResearchInterests.Output> {
    public record Input(UUID id, String uid) {}

    public interface Output {
        ResearchInterestGateway.Page result();
    }
}
