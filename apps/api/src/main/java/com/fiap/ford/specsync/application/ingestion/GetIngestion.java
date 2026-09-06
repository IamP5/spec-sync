package com.fiap.ford.specsync.application.ingestion;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.ingestion.Ingestion;

public abstract class GetIngestion extends UseCase<GetIngestion.Input, GetIngestion.Output> {
    public record Input(java.util.UUID id, String owner) {}

    public interface Output {
        Ingestion.Run result();
    }
}
