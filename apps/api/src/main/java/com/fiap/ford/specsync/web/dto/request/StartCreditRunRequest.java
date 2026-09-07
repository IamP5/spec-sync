package com.fiap.ford.specsync.web.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Admission of one chat turn. {@code runId} is the idempotency key of the run. */
public record StartCreditRunRequest(
        @NotBlank @Size(max = 200) String runId,
        @NotBlank @Size(max = 100) String provider,
        @NotBlank @Size(max = 200) String modelId,
        @Size(max = 200) String threadId) {}
