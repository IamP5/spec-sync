package com.fiap.ford.specsync.application.ingestion.impl;

import com.fiap.ford.specsync.application.ingestion.ListIngestions;
import com.fiap.ford.specsync.domain.ingestion.*;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultListIngestions extends ListIngestions {
    private final IngestionGateway gateway;

    public DefaultListIngestions(IngestionGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.list(input.owner()));
    }

    record StdOutput(java.util.List<Ingestion.Summary> result) implements Output {}
}
