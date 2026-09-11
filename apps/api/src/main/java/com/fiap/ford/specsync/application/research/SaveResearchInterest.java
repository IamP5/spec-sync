package com.fiap.ford.specsync.application.research;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.research.ResearchInterestGateway;
import java.util.UUID;

public abstract class SaveResearchInterest extends UseCase<SaveResearchInterest.Input, SaveResearchInterest.Output> {
    public record Input(UUID id, String uid, boolean visible, String name, String contactUrl) {}

    public interface Output {
        ResearchInterestGateway.Page result();
    }
}
