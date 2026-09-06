package com.fiap.ford.specsync.application.catalog;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.catalog.Catalog;
import java.util.List;
import java.util.UUID;

public abstract class GetVehicleSpecifications
        extends UseCase<GetVehicleSpecifications.Input, GetVehicleSpecifications.Output> {
    public record Input(UUID configurationId, List<String> attributes) {}

    public interface Output {
        Catalog.Comparison result();
    }
}
