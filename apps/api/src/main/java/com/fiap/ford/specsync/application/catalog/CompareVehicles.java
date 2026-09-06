package com.fiap.ford.specsync.application.catalog;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.catalog.Catalog;

public abstract class CompareVehicles extends UseCase<CompareVehicles.Input, CompareVehicles.Output> {
    public record Input(java.util.List<java.util.UUID> configurationIds, java.util.List<String> attributes) {}

    public interface Output {
        Catalog.Comparison result();
    }
}
