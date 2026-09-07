package com.fiap.ford.specsync.application.credits.impl;

import com.fiap.ford.specsync.application.credits.GetWallet;
import com.fiap.ford.specsync.domain.credits.Credits;
import com.fiap.ford.specsync.domain.credits.CreditsGateway;
import com.fiap.ford.specsync.domain.credits.WalletId;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultGetWallet extends GetWallet {

    private final CreditsGateway gateway;

    public DefaultGetWallet(final CreditsGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(final Input input) {
        return new StdOutput(gateway.wallet(WalletId.from(input.uid())), gateway.tariffs());
    }

    record StdOutput(Credits.Wallet wallet, List<Credits.ModelTariff> tariffs) implements Output {}
}
