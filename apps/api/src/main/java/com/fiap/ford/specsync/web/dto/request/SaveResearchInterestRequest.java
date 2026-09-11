package com.fiap.ford.specsync.web.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SaveResearchInterestRequest(
        @NotNull Boolean visible,
        @Size(max = 80) String name,
        @Size(max = 500) String contactUrl) {}
