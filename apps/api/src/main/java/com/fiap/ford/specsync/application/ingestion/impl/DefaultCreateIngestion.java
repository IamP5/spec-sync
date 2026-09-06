package com.fiap.ford.specsync.application.ingestion.impl;

import com.fiap.ford.specsync.application.ingestion.CreateIngestion;
import com.fiap.ford.specsync.domain.ingestion.*;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultCreateIngestion extends CreateIngestion {
    private final IngestionGateway gateway;

    public DefaultCreateIngestion(IngestionGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.create(input.id(), input.owner(), input.request()));
    }

    record StdOutput(Ingestion.Run result) implements Output {}
}
