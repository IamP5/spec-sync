package com.fiap.ford.specsync.application.research;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.research.Research;

public abstract class CreateResearch extends UseCase<CreateResearch.Input, CreateResearch.Output> {
    public record Input(
            java.util.UUID id, String uid, com.fiap.ford.specsync.domain.ingestion.Ingestion.Request request) {}

    public interface Output {
        Research.Snapshot result();
    }
}
