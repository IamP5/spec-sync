package com.fiap.ford.specsync.application.credits.impl;

import com.fiap.ford.specsync.application.credits.StartCreditRun;
import com.fiap.ford.specsync.domain.credits.CreditAmount;
import com.fiap.ford.specsync.domain.credits.CreditsGateway;
import com.fiap.ford.specsync.domain.credits.WalletId;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultStartCreditRun extends StartCreditRun {

    private final CreditsGateway gateway;

    public DefaultStartCreditRun(final CreditsGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(final Input input) {
        // Admission has to read the balance and write the hold under the same lock, so the whole
        // decision belongs to the adapter's transaction; the rule itself lives in Credits.admit.
        final var admission = gateway.startRun(
                WalletId.from(input.uid()), input.runId(), input.provider(), input.modelId(), input.threadId());
        return new StdOutput(
                admission.runId(), admission.hold(), admission.balance(), admission.available(), admission.exhausted());
    }

    record StdOutput(String runId, CreditAmount hold, CreditAmount balance, CreditAmount available, boolean exhausted)
            implements Output {}
}
