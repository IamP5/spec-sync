package com.fiap.ford.specsync.application.research;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.research.Research;

public abstract class GetResearch extends UseCase<GetResearch.Input, GetResearch.Output> {
    public record Input(java.util.UUID id, String uid) {}

    public interface Output {
        Research.Snapshot result();
    }
}
