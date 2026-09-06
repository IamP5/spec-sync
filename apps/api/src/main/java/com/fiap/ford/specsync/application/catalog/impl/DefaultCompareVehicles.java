package com.fiap.ford.specsync.application.catalog.impl;

import com.fiap.ford.specsync.application.catalog.CompareVehicles;
import com.fiap.ford.specsync.domain.catalog.*;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultCompareVehicles extends CompareVehicles {
    private final CatalogGateway gateway;

    public DefaultCompareVehicles(CatalogGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.compare(new ComparisonSelection(input.configurationIds(), input.attributes())));
    }

    record StdOutput(Catalog.Comparison result) implements Output {}
}
