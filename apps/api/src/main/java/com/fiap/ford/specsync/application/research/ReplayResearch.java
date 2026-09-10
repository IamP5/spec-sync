package com.fiap.ford.specsync.application.research;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.research.Research;
import java.util.UUID;

public abstract class ReplayResearch extends UseCase<ReplayResearch.Input, ReplayResearch.Output> {
    public record Input(UUID id, String uid, UUID newId) {}

    public interface Output {
        Research.Snapshot result();
    }
}
