package com.fiap.ford.specsync.application.credits.impl;

import com.fiap.ford.specsync.application.credits.RecordCreditUsage;
import com.fiap.ford.specsync.domain.credits.CreditAmount;
import com.fiap.ford.specsync.domain.credits.Credits;
import com.fiap.ford.specsync.domain.credits.CreditsGateway;
import com.fiap.ford.specsync.domain.credits.WalletId;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultRecordCreditUsage extends RecordCreditUsage {

    private final CreditsGateway gateway;

    public DefaultRecordCreditUsage(final CreditsGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(final Input input) {
        // The charge is priced by the adapter against the tariff it resolves under the lock; the
        // step carries the reported tokens only, with a zero charge until then.
        final var step = new Credits.RunStep(
                input.stepKey(),
                input.provider(),
                input.modelId(),
                input.inputTokens(),
                input.cachedInputTokens(),
                input.outputTokens(),
                input.reasoningTokens(),
                input.estimated(),
                CreditAmount.ZERO,
                null);
        final var usage = gateway.recordUsage(WalletId.from(input.uid()), input.runId(), step);
        return new StdOutput(usage.charge(), usage.balance(), usage.available(), usage.exhausted());
    }

    record StdOutput(CreditAmount charge, CreditAmount balance, CreditAmount available, boolean exhausted)
            implements Output {}
}
