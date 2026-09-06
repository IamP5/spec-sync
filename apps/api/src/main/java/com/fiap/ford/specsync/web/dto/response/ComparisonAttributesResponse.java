package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.catalog.ListComparisonAttributes;
import com.fiap.ford.specsync.domain.catalog.Catalog;
import java.util.List;

public record ComparisonAttributesResponse(List<Catalog.Attribute> items) {
    public static ComparisonAttributesResponse from(ListComparisonAttributes.Output output) {
        return new ComparisonAttributesResponse(output.result());
    }
}
