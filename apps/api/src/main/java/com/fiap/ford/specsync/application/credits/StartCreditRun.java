package com.fiap.ford.specsync.application.credits;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.credits.CreditAmount;

/**
 * Admits one chat turn: ensures the wallet, checks that it still covers a minimum useful answer on
 * the selected model and reserves the run's hold. Idempotent per run id.
 */
public abstract class StartCreditRun extends UseCase<StartCreditRun.Input, StartCreditRun.Output> {

    public record Input(String uid, String runId, String provider, String modelId, String threadId) {}

    public interface Output {

        String runId();

        CreditAmount hold();

        CreditAmount balance();

        CreditAmount available();

        boolean exhausted();
    }
}
