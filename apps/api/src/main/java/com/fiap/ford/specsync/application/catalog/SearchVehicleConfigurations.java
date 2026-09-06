package com.fiap.ford.specsync.application.catalog;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.catalog.Catalog;

public abstract class SearchVehicleConfigurations
        extends UseCase<SearchVehicleConfigurations.Input, SearchVehicleConfigurations.Output> {
    public record Input(String query, String market, Integer modelYear, int limit, int offset) {}

    public interface Output {
        Catalog.Page result();
    }
}
