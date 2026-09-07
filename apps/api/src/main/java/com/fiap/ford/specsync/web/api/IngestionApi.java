package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.request.*;
import com.fiap.ford.specsync.web.dto.response.IngestionListResponse;
import com.fiap.ford.specsync.web.dto.response.IngestionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Vehicle ingestion")
@RequestMapping(value = "/api/ingestions", produces = "application/json")
public interface IngestionApi {
    @PostMapping
    @Operation(summary = "Queue one source for one or more configurations; request UUID is the idempotency key")
    IngestionResponse create(@Valid @RequestBody CreateIngestionRequest request, Principal principal);

    @GetMapping
    @Operation(summary = "List the curator's imports, newest first")
    IngestionListResponse list(Principal principal);

    @GetMapping("/{id}")
    @Operation(summary = "Read persisted progress and review evidence")
    IngestionResponse get(@PathVariable UUID id, Principal principal);

    @GetMapping(value = "/{id}/source", produces = "application/octet-stream")
    @Operation(summary = "Download the immutable source bytes used for this draft")
    org.springframework.http.ResponseEntity<byte[]> source(@PathVariable UUID id, Principal principal);

    @PostMapping("/{id}/publish")
    @Operation(summary = "Publish selected claims of the exact reviewed draft, per configuration")
    IngestionResponse publish(
            @PathVariable UUID id, @Valid @RequestBody PublishIngestionRequest request, Principal principal);

    @PostMapping("/{id}/reject")
    @Operation(summary = "Reject or cancel an unpublished import")
    IngestionResponse reject(@PathVariable UUID id, Principal principal);
}
