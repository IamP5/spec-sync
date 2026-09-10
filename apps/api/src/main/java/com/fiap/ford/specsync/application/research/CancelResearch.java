package com.fiap.ford.specsync.application.research;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.research.Research;

public abstract class CancelResearch extends UseCase<CancelResearch.Input, CancelResearch.Output> {
    public record Input(java.util.UUID id, String uid) {}

    public interface Output {
        Research.Snapshot result();
    }
}
