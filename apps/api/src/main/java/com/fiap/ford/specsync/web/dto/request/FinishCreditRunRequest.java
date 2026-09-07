package com.fiap.ford.specsync.web.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Terminal status of a run: {@code COMPLETED}, {@code STOPPED}, {@code FAILED} or {@code EXHAUSTED}. */
public record FinishCreditRunRequest(@NotBlank String status) {}
