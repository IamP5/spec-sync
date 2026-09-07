package com.fiap.ford.specsync.domain.credits;

import java.util.List;

/**
 * Outbound port of the wallet. One port for the whole aggregate: every operation has to be atomic
 * on the wallet row, so splitting it would only invite a caller to compose two transactions.
 *
 * <p>Implementations ensure the wallet and its signup grant exist on first contact, idempotently.
 */
public interface CreditsGateway {

    /** The wallet view, creating the wallet and its signup grant if this is the first contact. */
    Credits.Wallet wallet(WalletId uid);

    /** Every active tariff, one per provider and model. */
    List<Credits.ModelTariff> tariffs();

    /** Admits a run and reserves its hold, or rejects it. Idempotent per {@code runId}. */
    Credits.Admission startRun(WalletId uid, String runId, String provider, String modelId, String threadId);

    /** Charges one step of an open run. Idempotent per {@code (runId, stepKey)}. */
    Credits.Usage recordUsage(WalletId uid, String runId, Credits.RunStep step);

    /** Releases the remaining hold and closes the run. Idempotent. */
    Credits.Wallet finishRun(WalletId uid, String runId, Credits.RunStatus status);
}
