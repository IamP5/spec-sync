package com.fiap.ford.specsync.application.knowledge;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.knowledge.*;

public abstract class RetrieveKnowledge extends UseCase<RetrieveKnowledge.Input, RetrieveKnowledge.Output> {
    public record Input(KnowledgeQuery query) {}

    public interface Output {
        KnowledgeResult result();
    }
}
