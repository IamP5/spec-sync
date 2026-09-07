package com.fiap.ford.specsync.application.credits;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.credits.Credits;
import java.util.List;

/** Closes a run, releases whatever it still holds and answers with the refreshed wallet view. */
public abstract class FinishCreditRun extends UseCase<FinishCreditRun.Input, FinishCreditRun.Output> {

    public record Input(String uid, String runId, String status) {}

    public interface Output {

        Credits.Wallet wallet();

        List<Credits.ModelTariff> tariffs();
    }
}
