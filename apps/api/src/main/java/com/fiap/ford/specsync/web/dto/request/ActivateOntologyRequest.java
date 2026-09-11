package com.fiap.ford.specsync.web.dto.request;

import jakarta.validation.constraints.*;

public record ActivateOntologyRequest(
        @Min(1) long baseRevision,
        @NotBlank @Size(max = 2000) String reason) {}
