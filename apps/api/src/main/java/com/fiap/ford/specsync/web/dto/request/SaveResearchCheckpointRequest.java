package com.fiap.ford.specsync.web.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SaveResearchCheckpointRequest(
        @NotBlank @Size(max = 12000000) String payload) {}
