package com.fiap.ford.specsync.application.catalog.impl;

import com.fiap.ford.specsync.application.catalog.ListComparisonAttributes;
import com.fiap.ford.specsync.domain.catalog.*;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultListComparisonAttributes extends ListComparisonAttributes {
    private final CatalogGateway gateway;

    public DefaultListComparisonAttributes(CatalogGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);
    }

    @Override
    public Output execute(Input input) {
        return new StdOutput(gateway.attributes());
    }

    record StdOutput(java.util.List<Catalog.Attribute> result) implements Output {}
}
