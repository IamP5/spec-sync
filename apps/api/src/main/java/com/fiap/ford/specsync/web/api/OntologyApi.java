package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.request.ActivateOntologyRequest;
import com.fiap.ford.specsync.web.dto.response.OntologyResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Ontology review")
@SecurityRequirement(name = "userToken")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Token missing or invalid"),
    @ApiResponse(responseCode = "403", description = "The CURATOR role is required")
})
@RequestMapping(value = "/api/ontology/proposals", produces = "application/json")
public interface OntologyApi {
    @GetMapping
    @Operation(summary = "List evidenced ontology proposals and projection progress")
    OntologyResponse list();

    @PostMapping("/{id}/activate")
    @Operation(summary = "Activate a reviewed additive ontology proposal")
    OntologyResponse activate(
            @PathVariable UUID id, @Valid @RequestBody ActivateOntologyRequest request, Principal principal);
}
