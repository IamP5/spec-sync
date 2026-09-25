package com.fiap.ford.specsync.application.ingestion;

import com.fiap.ford.specsync.application.UseCase;
import java.time.Duration;

/**
 * Runs worker cycles (one extraction, then one graph projection) until a cycle finds no work or
 * the budget is spent. The budget only stops new cycles from starting; a running cycle always
 * finishes, and at least one cycle runs.
 */
public abstract class DrainIngestion extends UseCase<DrainIngestion.Input, DrainIngestion.Output> {

    public record Input(Duration budget) {}

    public interface Output {
        /** Cycles that claimed at least one unit of work. */
        int cycles();
    }
}
