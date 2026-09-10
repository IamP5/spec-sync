package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.request.CreateResearchRequest;
import com.fiap.ford.specsync.web.dto.request.PublishIngestionRequest;
import com.fiap.ford.specsync.web.dto.request.ReplayResearchRequest;
import com.fiap.ford.specsync.web.dto.request.SaveResearchInterestRequest;
import com.fiap.ford.specsync.web.dto.response.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Private research subscriptions")
@RequestMapping(value = "/api/internal/research/users/{uid}/requests", produces = "application/json")
public interface ResearchApi {
    @PostMapping
    @Operation(summary = "Create or join source research for a verified user")
    ResearchResponse create(@PathVariable String uid, @Valid @RequestBody CreateResearchRequest input);

    @GetMapping
    @Operation(summary = "List only this user's research subscriptions")
    ResearchListResponse list(@PathVariable String uid);

    @GetMapping("/{id}")
    @Operation(summary = "Read this user's persisted research progress")
    ResearchResponse get(@PathVariable String uid, @PathVariable UUID id);

    @GetMapping("/{id}/review")
    @Operation(summary = "Open the existing research draft for authenticated review")
    IngestionResponse review(@PathVariable String uid, @PathVariable UUID id);

    @GetMapping("/{id}/review/source")
    ResearchSourceResponse reviewSource(@PathVariable String uid, @PathVariable UUID id);

    @PostMapping("/{id}/review/publish")
    @Operation(summary = "Publish selected claims from the existing research draft")
    IngestionResponse publishReview(
            @PathVariable String uid, @PathVariable UUID id, @Valid @RequestBody PublishIngestionRequest input);

    @PostMapping("/{id}/replay")
    @Operation(summary = "Reinterpret an immutable capture under the current ontology")
    ResearchResponse replay(
            @PathVariable String uid, @PathVariable UUID id, @Valid @RequestBody ReplayResearchRequest input);

    @GetMapping("/{id}/interests")
    @Operation(summary = "List consented profiles in this research scope")
    ResearchInterestsResponse interests(@PathVariable String uid, @PathVariable UUID id);

    @PostMapping("/{id}/interests")
    @Operation(summary = "Share, update or remove your own research contact profile")
    ResearchInterestsResponse saveInterest(
            @PathVariable String uid, @PathVariable UUID id, @Valid @RequestBody SaveResearchInterestRequest input);

    @DeleteMapping("/{id}")
    @Operation(summary = "Detach this user's request without cancelling shared work")
    ResearchResponse cancel(@PathVariable String uid, @PathVariable UUID id);
}
