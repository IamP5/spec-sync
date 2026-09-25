package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.ingestion.DrainIngestion;

/** Result of one scheduler-driven drain; logged by Cloud Scheduler with each attempt. */
public record IngestionDrainResponse(int cycles) {
    public static IngestionDrainResponse from(final DrainIngestion.Output output) {
        return new IngestionDrainResponse(output.cycles());
    }
}
