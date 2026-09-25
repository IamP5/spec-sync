package com.fiap.ford.specsync.application.ingestion.impl;

import com.fiap.ford.specsync.application.ingestion.ProcessIngestion;
import com.fiap.ford.specsync.domain.catalog.CatalogGateway;
import com.fiap.ford.specsync.domain.ingestion.*;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultProcessIngestion extends ProcessIngestion {
    private final IngestionGateway gateway;
    private final IngestionExtractionGateway extraction;
    private final CatalogGateway catalog;

    public DefaultProcessIngestion(
            IngestionGateway gateway, IngestionExtractionGateway extraction, CatalogGateway catalog) {
        this.gateway = Objects.requireNonNull(gateway);
        this.extraction = Objects.requireNonNull(extraction);
        this.catalog = Objects.requireNonNull(catalog);
    }

    @Override
    public Boolean execute(Boolean projection) {
        if (projection) {
            var claimed = gateway.claimProjection();
            claimed.ifPresent(work -> {
                try {
                    extraction.project(work);
                    gateway.finishProjection(work, null);
                } catch (RuntimeException e) {
                    gateway.finishProjection(work, "Graph update failed; automatic retry pending.");
                }
            });
            return claimed.isPresent();
        }
        var claimed = gateway.claim();
        claimed.ifPresent(work -> {
            try {
                gateway.complete(
                        work,
                        extraction.extract(
                                work,
                                work.ontology() == null
                                        ? catalog.attributes()
                                        : work.ontology().attributes()));
            } catch (RuntimeException e) {
                gateway.fail(
                        work,
                        "Source processing failed. Check source support, worker configuration and server logs, then submit a new run after three attempts.");
            }
        });
        return claimed.isPresent();
    }
}
