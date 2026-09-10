package com.fiap.ford.specsync.application.research;

import com.fiap.ford.specsync.application.UnitUseCase;

public abstract class SaveResearchCheckpoint extends UnitUseCase<SaveResearchCheckpoint.Input> {
    public record Input(
            java.util.UUID workId,
            java.util.UUID attemptId,
            com.fiap.ford.specsync.domain.research.Research.Checkpoint checkpoint) {}
}
