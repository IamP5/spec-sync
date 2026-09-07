package com.fiap.ford.specsync.web.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Reported usage of one agent step. {@code stepKey} makes the charge idempotent within the run.
 * {@code reasoningTokens} is recorded only: providers bill reasoning inside {@code outputTokens}.
 * {@code estimated} marks counts the AI service assumed because the provider reported none.
 */
public record RecordCreditUsageRequest(
        @NotBlank @Size(max = 200) String stepKey,
        @Size(max = 100) String provider,
        @Size(max = 200) String modelId,
        @PositiveOrZero long inputTokens,
        @PositiveOrZero long cachedInputTokens,
        @PositiveOrZero long outputTokens,
        @PositiveOrZero long reasoningTokens,
        boolean estimated) {}
