package com.fiap.ford.specsync.application.credits;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.credits.CreditAmount;

/**
 * Charges one step of an open run at the model's published rate. Idempotent per step key: a replay
 * returns the stored charge instead of debiting again.
 */
public abstract class RecordCreditUsage extends UseCase<RecordCreditUsage.Input, RecordCreditUsage.Output> {

    public record Input(
            String uid,
            String runId,
            String stepKey,
            String provider,
            String modelId,
            long inputTokens,
            long cachedInputTokens,
            long outputTokens,
            long reasoningTokens,
            boolean estimated) {}

    public interface Output {

        CreditAmount charge();

        CreditAmount balance();

        CreditAmount available();

        boolean exhausted();
    }
}
