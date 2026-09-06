package com.fiap.ford.specsync.web.controllers;

import com.fiap.ford.specsync.application.catalog.*;
import com.fiap.ford.specsync.web.api.CatalogApi;
import com.fiap.ford.specsync.web.dto.response.*;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CatalogController implements CatalogApi {
    private final SearchVehicleConfigurations search;
    private final ListComparisonAttributes attributes;
    private final CompareVehicles compare;

    public CatalogController(
            SearchVehicleConfigurations search, ListComparisonAttributes attributes, CompareVehicles compare) {
        this.search = Objects.requireNonNull(search);
        this.attributes = Objects.requireNonNull(attributes);
        this.compare = Objects.requireNonNull(compare);
    }

    @Override
    public ConfigurationSearchResponse search(String q, String market, Integer modelYear, int limit, int offset) {
        return search.execute(
                new SearchVehicleConfigurations.Input(q, market, modelYear, limit, offset),
                ConfigurationSearchResponse::from);
    }

    @Override
    public ComparisonAttributesResponse attributes() {
        return attributes.execute(new ListComparisonAttributes.Input(), ComparisonAttributesResponse::from);
    }

    @Override
    public ComparisonResponse compare(List<UUID> configurationIds, List<String> attributes) {
        return compare.execute(new CompareVehicles.Input(configurationIds, attributes), ComparisonResponse::from);
    }
}
