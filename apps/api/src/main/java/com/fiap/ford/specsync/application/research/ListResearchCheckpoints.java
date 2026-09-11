package com.fiap.ford.specsync.application.research;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.research.Research;

public abstract class ListResearchCheckpoints
        extends UseCase<ListResearchCheckpoints.Input, ListResearchCheckpoints.Output> {
    public record Input(java.util.UUID workId, java.util.UUID attemptId) {}

    public interface Output {
        java.util.List<Research.Checkpoint> result();
    }
}
