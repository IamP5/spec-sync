package com.fiap.ford.specsync.web.controllers;

import com.fiap.ford.specsync.application.ingestion.DrainIngestion;
import com.fiap.ford.specsync.web.api.IngestionWorkerApi;
import com.fiap.ford.specsync.web.dto.response.IngestionDrainResponse;
import java.time.Duration;
import java.util.Objects;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class IngestionWorkerController implements IngestionWorkerApi {

    /**
     * No new cycle starts after three minutes. One cycle can take about 24.5 minutes (a 20-minute
     * research extraction plus a 260-second projection), so a drain still answers within Cloud
     * Scheduler's 30-minute attempt deadline and the API's request timeout
     * (infra/environments/dev/ingestion-worker.tf).
     */
    static final Duration BUDGET = Duration.ofMinutes(3);

    private final DrainIngestion drain;

    public IngestionWorkerController(final DrainIngestion drain) {
        this.drain = Objects.requireNonNull(drain);
    }

    @Override
    public IngestionDrainResponse drain() {
        return drain.execute(new DrainIngestion.Input(BUDGET), IngestionDrainResponse::from);
    }
}
