package com.fiap.ford.specsync.application.catalog.impl;

import com.fiap.ford.specsync.application.catalog.GetVehicleSpecifications;
import com.fiap.ford.specsync.domain.catalog.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class DefaultGetVehicleSpecifications extends GetVehicleSpecifications {
    private final CatalogGateway gateway;

    public DefaultGetVehicleSpecifications(CatalogGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    public Output execute(Input input) {
        return new StdOutput(gateway.specifications(
                new SpecificationSelection(Collections.singletonList(input.configurationId()), input.attributes())));
    }

    record StdOutput(Catalog.Comparison result) implements Output {}
}
