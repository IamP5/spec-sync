package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.catalog.GetVehicleSpecifications;
import com.fiap.ford.specsync.domain.catalog.Catalog;
import java.util.List;

public record SpecificationResponse(List<Catalog.Configuration> configurations, List<Catalog.Row> rows) {
    public static SpecificationResponse from(GetVehicleSpecifications.Output output) {
        return new SpecificationResponse(
                output.result().configurations(), output.result().rows());
    }
}
