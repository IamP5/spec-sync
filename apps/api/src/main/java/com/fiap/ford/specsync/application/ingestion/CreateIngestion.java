package com.fiap.ford.specsync.application.ingestion;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.ingestion.Ingestion;

public abstract class CreateIngestion extends UseCase<CreateIngestion.Input, CreateIngestion.Output> {
    public record Input(java.util.UUID id, String owner, Ingestion.Request request) {}

    public interface Output {
        Ingestion.Run result();
    }
}
