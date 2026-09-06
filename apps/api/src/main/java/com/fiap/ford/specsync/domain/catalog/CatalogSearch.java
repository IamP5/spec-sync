package com.fiap.ford.specsync.domain.catalog;

import com.fiap.ford.specsync.domain.shared.AssertionConcern;
import com.fiap.ford.specsync.domain.shared.ValueObject;

public record CatalogSearch(String query, String market, Integer modelYear, int limit, int offset)
        implements ValueObject, AssertionConcern {
    public CatalogSearch {
        query = query == null ? "" : query.strip();
        assertConditionTrue(query.length() <= 100, "q", "Search text must have at most 100 characters.");
        assertConditionTrue(
                market == null || market.matches("[A-Z]{2}"), "market", "Market must be a two-letter uppercase code.");
        assertConditionTrue(
                modelYear == null || (modelYear >= 1900 && modelYear <= 2200),
                "modelYear",
                "Model year must be between 1900 and 2200.");
        assertConditionTrue(limit >= 1 && limit <= 100, "limit", "Limit must be between 1 and 100.");
        assertConditionTrue(offset >= 0 && offset <= 100000, "offset", "Offset must be between 0 and 100000.");
    }
}
