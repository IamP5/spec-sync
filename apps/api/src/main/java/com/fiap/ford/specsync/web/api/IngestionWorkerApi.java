package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.response.IngestionDrainResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/** Scheduler-driven ingestion worker; replaces a resident poller so the API can scale to zero. */
@Tag(name = "Ingestion worker")
@RequestMapping("/api/internal/ingestion")
public interface IngestionWorkerApi {

    @Operation(
            summary = "Process queued extraction and graph projection work",
            description = "Called every minute by Cloud Scheduler with a Google ID token of its service account.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Queue empty or time budget spent"),
        @ApiResponse(responseCode = "401", description = "Caller is not the scheduler's service account")
    })
    @PostMapping("/drain")
    IngestionDrainResponse drain();
}
