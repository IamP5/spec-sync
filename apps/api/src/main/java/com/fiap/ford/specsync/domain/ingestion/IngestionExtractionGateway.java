package com.fiap.ford.specsync.domain.ingestion;

import com.fiap.ford.specsync.domain.catalog.Catalog;
import java.util.List;

public interface IngestionExtractionGateway {
    Ingestion.Draft extract(Ingestion.Request request, List<Catalog.Attribute> attributes);

    default Ingestion.Draft extract(Ingestion.Work work, List<Catalog.Attribute> attributes) {
        return extract(work.request(), attributes);
    }

    void project(Ingestion.Projection projection);
}
