package com.fiap.ford.specsync.domain.ingestion;

import com.fiap.ford.specsync.domain.catalog.Catalog;
import java.util.List;

public interface IngestionExtractionGateway {
    Ingestion.Draft extract(Ingestion.Request request, List<Catalog.Attribute> attributes);

    void project(Ingestion.Projection projection);
}
