package com.fiap.ford.specsync.application.credits.impl;

import com.fiap.ford.specsync.application.credits.FinishCreditRun;
import com.fiap.ford.specsync.domain.credits.Credits;
import com.fiap.ford.specsync.domain.credits.CreditsGateway;
import com.fiap.ford.specsync.domain.credits.WalletId;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultFinishCreditRun extends FinishCreditRun {

    private final CreditsGateway gateway;

    public DefaultFinishCreditRun(final CreditsGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(final Input input) {
        final var wallet = gateway.finishRun(
                WalletId.from(input.uid()), input.runId(), Credits.RunStatus.finishing(input.status()));
        return new StdOutput(wallet, gateway.tariffs());
    }

    record StdOutput(Credits.Wallet wallet, List<Credits.ModelTariff> tariffs) implements Output {}
}
