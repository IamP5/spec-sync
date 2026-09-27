package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.request.*;
import com.fiap.ford.specsync.web.dto.response.IngestionListResponse;
import com.fiap.ford.specsync.web.dto.response.IngestionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Curator review of vehicle sources. Requires the {@code CURATOR} role (or {@code ADMIN}) in the
 * verified user token; the queue is shared by all curators and each decision records the reviewer.
 */
@Tag(name = "Vehicle ingestion")
@SecurityRequirement(name = "userToken")
@RequestMapping(value = "/api/ingestions", produces = "application/json")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Token missing or invalid"),
    @ApiResponse(responseCode = "403", description = "The CURATOR role is required")
})
public interface IngestionApi {
    @PostMapping
    @Operation(summary = "Queue one source for one or more configurations; request UUID is the idempotency key")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Import queued; Location points to it"),
        @ApiResponse(responseCode = "400", description = "Malformed request"),
        @ApiResponse(responseCode = "422", description = "Source or configurations rejected")
    })
    ResponseEntity<IngestionResponse> create(@Valid @RequestBody CreateIngestionRequest request, Principal principal);

    @GetMapping
    @Operation(summary = "List the curators' imports, newest first")
    IngestionListResponse list(Principal principal);

    @GetMapping("/{id}")
    @Operation(summary = "Read persisted progress and review evidence")
    @ApiResponses({@ApiResponse(responseCode = "422", description = "Unknown import")})
    IngestionResponse get(@PathVariable UUID id, Principal principal);

    @GetMapping(value = "/{id}/source", produces = "application/octet-stream")
    @Operation(summary = "Download the immutable source bytes used for this draft")
    ResponseEntity<byte[]> source(@PathVariable UUID id, Principal principal);

    @PostMapping("/{id}/publish")
    @Operation(summary = "Publish selected claims of the exact reviewed draft, per configuration")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Draft published"),
        @ApiResponse(responseCode = "422", description = "Draft changed, already decided or selection invalid")
    })
    IngestionResponse publish(
            @PathVariable UUID id, @Valid @RequestBody PublishIngestionRequest request, Principal principal);

    @PostMapping("/{id}/reject")
    @Operation(summary = "Reject or cancel an unpublished import")
    IngestionResponse reject(@PathVariable UUID id, Principal principal);
}
