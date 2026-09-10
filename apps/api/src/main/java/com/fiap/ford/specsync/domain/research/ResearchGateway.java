package com.fiap.ford.specsync.domain.research;

import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import java.util.List;
import java.util.UUID;

public interface ResearchGateway {
    Research.Snapshot create(UUID id, String uid, Ingestion.Request request);

    Research.Snapshot get(UUID id, String uid);

    default Research.Snapshot replay(UUID id, String uid, UUID newId) {
        throw new UnsupportedOperationException();
    }

    List<Research.Summary> list(String uid);

    Research.Snapshot cancel(UUID id, String uid);

    void heartbeat(UUID workId, UUID attemptId);

    List<Research.Checkpoint> checkpoints(UUID workId, UUID attemptId);

    void checkpoint(UUID workId, UUID attemptId, Research.Checkpoint checkpoint);
}
