package com.fiap.ford.specsync.infrastructure.messaging;

import com.fiap.ford.specsync.application.ingestion.ProcessIngestion;
import com.fiap.ford.specsync.infrastructure.configuration.IngestionProperties;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Resident poller for local development. On Cloud Run the instance scales to zero, so polling is
 * switched off and Cloud Scheduler drives the queue through {@code POST /api/internal/ingestion/drain}.
 */
@Component
@ConditionalOnProperty(name = "specsync.ingestion.poll", havingValue = "true", matchIfMissing = true)
public class IngestionWorker {
    private static final Logger LOG = LoggerFactory.getLogger(IngestionWorker.class);
    private final ProcessIngestion process;
    private final IngestionProperties properties;

    public IngestionWorker(ProcessIngestion process, IngestionProperties properties) {
        this.process = Objects.requireNonNull(process);
        this.properties = Objects.requireNonNull(properties);
    }

    @Scheduled(fixedDelay = 10000, initialDelay = 15000)
    public void tick() {
        if (!properties.enabled()) return;
        try {
            process.execute(false);
            process.execute(true);
        } catch (RuntimeException e) {
            LOG.warn("Ingestion worker cycle failed; durable work will be retried", e);
        }
    }
}
