package com.fiap.ford.specsync.application.research;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.research.Research;

public abstract class ListResearch extends UseCase<ListResearch.Input, ListResearch.Output> {
    public record Input(String uid) {}

    public interface Output {
        java.util.List<Research.Summary> result();
    }
}
