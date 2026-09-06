package com.fiap.ford.specsync.application.catalog;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.catalog.Catalog;

public abstract class ListComparisonAttributes
        extends UseCase<ListComparisonAttributes.Input, ListComparisonAttributes.Output> {
    public record Input() {}

    public interface Output {
        java.util.List<Catalog.Attribute> result();
    }
}
