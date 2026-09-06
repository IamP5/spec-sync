package com.fiap.ford.specsync.application.ingestion.impl;

import com.fiap.ford.specsync.application.ingestion.RejectIngestion;
import com.fiap.ford.specsync.domain.ingestion.*;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultRejectIngestion extends RejectIngestion {
    private final IngestionGateway gateway;

    public DefaultRejectIngestion(IngestionGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.reject(input.id(), input.owner()));
    }

    record StdOutput(Ingestion.Run result) implements Output {}
}
