package com.fiap.ford.specsync.application.research;

import com.fiap.ford.specsync.application.UnitUseCase;

public abstract class HeartbeatResearch extends UnitUseCase<HeartbeatResearch.Input> {
    public record Input(java.util.UUID workId, java.util.UUID attemptId) {}
}
