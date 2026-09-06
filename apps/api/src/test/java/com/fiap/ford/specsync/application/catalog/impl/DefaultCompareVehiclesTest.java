package com.fiap.ford.specsync.application.catalog.impl;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.application.catalog.*;
import com.fiap.ford.specsync.domain.catalog.*;
import com.fiap.ford.specsync.domain.exceptions.DomainException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DefaultCompareVehiclesTest {
    @Test
    void validatesBeforeCallingGatewayAndPreservesSelection() {
        var gateway = new FakeCatalogGateway();
        var useCase = new DefaultCompareVehicles(gateway);
        assertThrows(DomainException.class, () -> useCase.execute(new CompareVehicles.Input(List.of(), null)));
        assertNull(gateway.selection);
        var ids = List.of(UUID.randomUUID(), UUID.randomUUID());
        assertSame(
                gateway.result,
                useCase.execute(new CompareVehicles.Input(ids, List.of("camera_360")))
                        .result());
        assertEquals(ids, gateway.selection.configurationIds());
        assertEquals(List.of("camera_360"), gateway.selection.attributes());
    }

    @Test
    void validatesSearchAndExposesAttributeDefinitions() {
        var gateway = new FakeCatalogGateway();
        var search = new DefaultSearchVehicleConfigurations(gateway);
        assertThrows(
                DomainException.class,
                () -> search.execute(new SearchVehicleConfigurations.Input("", null, null, 0, 0)));
        assertNull(gateway.search);
        var page = search.execute(new SearchVehicleConfigurations.Input("  Ranger ", "BR", 2026, 2, 1))
                .result();
        assertEquals("Ranger", gateway.search.query());
        assertEquals(2, page.limit());
        assertEquals(1, page.offset());
        assertEquals(
                List.of(),
                new DefaultListComparisonAttributes(gateway)
                        .execute(new ListComparisonAttributes.Input())
                        .result());
    }

    private static class FakeCatalogGateway implements CatalogGateway {
        public Catalog.Comparison specifications(
                com.fiap.ford.specsync.domain.catalog.SpecificationSelection selection) {
            throw new UnsupportedOperationException();
        }

        ComparisonSelection selection;
        CatalogSearch search;
        final Catalog.Comparison result = new Catalog.Comparison(List.of(), List.of());

        public Catalog.Page search(CatalogSearch search) {
            this.search = search;
            return new Catalog.Page(List.of(), search.limit(), search.offset(), false);
        }

        public List<Catalog.Attribute> attributes() {
            return List.of();
        }

        public Catalog.Comparison compare(ComparisonSelection selection) {
            this.selection = selection;
            return result;
        }
    }
}
