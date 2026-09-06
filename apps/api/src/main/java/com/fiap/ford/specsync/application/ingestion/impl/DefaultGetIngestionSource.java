package com.fiap.ford.specsync.application.ingestion.impl;

import com.fiap.ford.specsync.application.ingestion.GetIngestionSource;
import com.fiap.ford.specsync.domain.ingestion.*;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultGetIngestionSource extends GetIngestionSource {
    private final IngestionGateway gateway;

    public DefaultGetIngestionSource(IngestionGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.source(input.id(), input.owner()));
    }

    record StdOutput(Ingestion.CapturedFile result) implements Output {}
}
