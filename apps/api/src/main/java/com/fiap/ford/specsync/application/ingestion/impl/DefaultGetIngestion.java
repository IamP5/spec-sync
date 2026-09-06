package com.fiap.ford.specsync.application.ingestion.impl;

import com.fiap.ford.specsync.application.ingestion.GetIngestion;
import com.fiap.ford.specsync.domain.ingestion.*;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultGetIngestion extends GetIngestion {
    private final IngestionGateway gateway;

    public DefaultGetIngestion(IngestionGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.get(input.id(), input.owner()));
    }

    record StdOutput(Ingestion.Run result) implements Output {}
}
