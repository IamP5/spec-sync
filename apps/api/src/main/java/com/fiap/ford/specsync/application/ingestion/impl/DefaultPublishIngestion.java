package com.fiap.ford.specsync.application.ingestion.impl;

import com.fiap.ford.specsync.application.ingestion.PublishIngestion;
import com.fiap.ford.specsync.domain.ingestion.*;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultPublishIngestion extends PublishIngestion {
    private final IngestionGateway gateway;

    public DefaultPublishIngestion(IngestionGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.publish(input.id(), input.owner(), input.review(), input.reviewer()));
    }

    record StdOutput(Ingestion.Run result) implements Output {}
}
