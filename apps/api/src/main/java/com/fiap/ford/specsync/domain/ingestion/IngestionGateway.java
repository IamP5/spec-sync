package com.fiap.ford.specsync.domain.ingestion;

import java.util.*;

public interface IngestionGateway {
    Ingestion.Run create(UUID id, String owner, Ingestion.Request request);

    Ingestion.Run get(UUID id, String owner);

    List<Ingestion.Summary> list(String owner);

    Ingestion.CapturedFile source(UUID id, String owner);

    Ingestion.Run publish(UUID id, String owner, Ingestion.Review review);

    Ingestion.Run reject(UUID id, String owner);

    Optional<Ingestion.Work> claim();

    void complete(Ingestion.Work work, Ingestion.Draft draft);

    void fail(Ingestion.Work work, String error);

    Optional<Ingestion.Projection> claimProjection();

    void finishProjection(Ingestion.Projection projection, String error);
}
