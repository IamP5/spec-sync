package com.fiap.ford.specsync.application.catalog.impl;

import com.fiap.ford.specsync.application.catalog.SearchVehicleConfigurations;
import com.fiap.ford.specsync.domain.catalog.*;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultSearchVehicleConfigurations extends SearchVehicleConfigurations {
    private final CatalogGateway gateway;

    public DefaultSearchVehicleConfigurations(CatalogGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.search(
                new CatalogSearch(input.query(), input.market(), input.modelYear(), input.limit(), input.offset())));
    }

    record StdOutput(Catalog.Page result) implements Output {}
}
