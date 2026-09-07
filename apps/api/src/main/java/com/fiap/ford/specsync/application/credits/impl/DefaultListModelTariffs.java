package com.fiap.ford.specsync.application.credits.impl;

import com.fiap.ford.specsync.application.credits.ListModelTariffs;
import com.fiap.ford.specsync.domain.credits.Credits;
import com.fiap.ford.specsync.domain.credits.CreditsGateway;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultListModelTariffs extends ListModelTariffs {

    private final CreditsGateway gateway;

    public DefaultListModelTariffs(final CreditsGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute() {
        return new StdOutput(gateway.tariffs());
    }

    record StdOutput(List<Credits.ModelTariff> models) implements Output {}
}
