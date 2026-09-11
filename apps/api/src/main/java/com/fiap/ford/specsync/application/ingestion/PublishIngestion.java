package com.fiap.ford.specsync.application.ingestion;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.ingestion.Ingestion;

public abstract class PublishIngestion extends UseCase<PublishIngestion.Input, PublishIngestion.Output> {
    public record Input(java.util.UUID id, String owner, Ingestion.Review review, String reviewer) {
        public Input(java.util.UUID id, String owner, Ingestion.Review review) {
            this(id, owner, review, owner);
        }
    }

    public interface Output {
        Ingestion.Run result();
    }
}
