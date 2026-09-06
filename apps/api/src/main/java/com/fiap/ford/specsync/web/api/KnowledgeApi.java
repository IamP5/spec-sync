package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.response.KnowledgeResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Vehicle knowledge")
@RequestMapping(value = "/api/knowledge", produces = "application/json")
public interface KnowledgeApi {
    @PostMapping("/reviews")
    @Operation(summary = "Search reviews with a query vector in the request body")
    KnowledgeResponse semanticReviews(@RequestBody com.fiap.ford.specsync.web.dto.request.ReviewSearchRequest request);

    @GetMapping("/concepts")
    @Operation(summary = "Resolve attribute terminology")
    KnowledgeResponse concepts(
            @RequestParam(name = "q", defaultValue = "") String q,
            @RequestParam(name = "limit", defaultValue = "10") int limit);

    @GetMapping("/capabilities")
    @Operation(summary = "Find configurations by accepted capability and package paths")
    KnowledgeResponse capabilities(
            @RequestParam(name = "attributeCode") String attributeCode,
            @RequestParam(name = "market", required = false) String market,
            @RequestParam(name = "modelYear", required = false) Integer modelYear,
            @RequestParam(name = "includeOptional", defaultValue = "true") boolean includeOptional,
            @RequestParam(name = "limit", defaultValue = "10") int limit);

    @GetMapping("/reviews")
    @Operation(summary = "Search indexed review passages; no ingestion")
    KnowledgeResponse reviews(
            @RequestParam(name = "q", defaultValue = "") String q,
            @RequestParam(name = "configurationId", required = false) UUID configurationId,
            @RequestParam(name = "attributeCode", required = false) String attributeCode,
            @RequestParam(name = "limit", defaultValue = "10") int limit,
            @RequestParam(name = "embedding", required = false) java.util.List<Double> embedding);

    @GetMapping("/related-reviews")
    @Operation(summary = "Find review passages related to a specification")
    KnowledgeResponse related(
            @RequestParam(name = "configurationId") UUID configurationId,
            @RequestParam(name = "attributeCode") String attributeCode,
            @RequestParam(name = "limit", defaultValue = "10") int limit);

    @GetMapping("/evidence/{id}")
    @Operation(summary = "Get an exact indexed evidence excerpt")
    KnowledgeResponse evidence(@PathVariable UUID id);
}
