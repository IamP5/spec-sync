package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.catalog.SearchVehicleConfigurations;
import com.fiap.ford.specsync.domain.catalog.Catalog;
import java.util.List;

public record ConfigurationSearchResponse(List<Catalog.Configuration> items, int limit, int offset, boolean hasMore) {
    public static ConfigurationSearchResponse from(SearchVehicleConfigurations.Output output) {
        var page = output.result();
        return new ConfigurationSearchResponse(page.items(), page.limit(), page.offset(), page.hasMore());
    }
}
