package com.fiap.ford.specsync.domain.catalog;

import com.fiap.ford.specsync.domain.shared.AssertionConcern;
import com.fiap.ford.specsync.domain.shared.ValueObject;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

public record SpecificationSelection(List<UUID> configurationIds, List<String> attributes)
        implements ValueObject, AssertionConcern {
    public SpecificationSelection {
        assertConditionTrue(
                configurationIds != null && configurationIds.size() == 1 && configurationIds.size() <= 5,
                "configurationIds",
                "Choose exactly one configuration.");
        assertConditionTrue(
                configurationIds.stream().allMatch(java.util.Objects::nonNull)
                        && new HashSet<>(configurationIds).size() == configurationIds.size(),
                "configurationIds",
                "Configuration IDs must be non-null and unique.");
        attributes = attributes == null ? List.of() : attributes;
        assertConditionTrue(
                attributes.size() <= 50
                        && attributes.stream().allMatch(a -> a != null && a.matches("[a-z][a-z0-9_]{0,79}"))
                        && new HashSet<>(attributes).size() == attributes.size(),
                "attributes",
                "Choose up to 50 unique attribute codes.");
        configurationIds = List.copyOf(configurationIds);
        attributes = List.copyOf(attributes);
    }
}
