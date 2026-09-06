package com.fiap.ford.specsync.domain.catalog;

import java.util.List;

public interface CatalogGateway {
    Catalog.Comparison specifications(SpecificationSelection selection);

    Catalog.Page search(CatalogSearch search);

    List<Catalog.Attribute> attributes();

    Catalog.Comparison compare(ComparisonSelection selection);
}
