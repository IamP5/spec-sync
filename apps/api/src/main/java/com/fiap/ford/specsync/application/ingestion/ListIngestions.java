package com.fiap.ford.specsync.application.ingestion;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.ingestion.Ingestion;

public abstract class ListIngestions extends UseCase<ListIngestions.Input, ListIngestions.Output> {
    public record Input(String owner) {}

    public interface Output {
        java.util.List<Ingestion.Summary> result();
    }
}
