package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.catalog.CompareVehicles;
import com.fiap.ford.specsync.domain.catalog.Catalog;
import java.util.List;

public record ComparisonResponse(List<Catalog.Configuration> configurations, List<Catalog.Row> rows) {
    public static ComparisonResponse from(CompareVehicles.Output output) {
        return new ComparisonResponse(
                output.result().configurations(), output.result().rows());
    }
}
