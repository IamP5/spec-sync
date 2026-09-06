package com.fiap.ford.specsync.domain.catalog;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ComparisonSelectionTest {
    @Test
    void rejectsInvalidConfigurationSelections() {
        var id = UUID.randomUUID();
        assertThrows(DomainException.class, () -> new ComparisonSelection(null, null));
        assertThrows(DomainException.class, () -> new ComparisonSelection(List.of(id), null));
        assertThrows(DomainException.class, () -> new ComparisonSelection(List.of(id, id), null));
        assertThrows(DomainException.class, () -> new ComparisonSelection(Arrays.asList(id, null), null));
        assertThrows(
                DomainException.class,
                () -> new ComparisonSelection(
                        java.util.stream.IntStream.range(0, 6)
                                .mapToObj(i -> UUID.randomUUID())
                                .toList(),
                        null));
    }

    @Test
    void preservesOrderAndDefensivelyCopiesSelection() {
        var ids = new ArrayList<>(List.of(UUID.randomUUID(), UUID.randomUUID()));
        var selection = new ComparisonSelection(ids, List.of("torque_max", "power_max"));
        var original = List.copyOf(ids);
        ids.clear();
        assertEquals(original, selection.configurationIds());
        assertEquals(List.of("torque_max", "power_max"), selection.attributes());
        assertEquals(List.of(), new ComparisonSelection(original, null).attributes());
    }

    @Test
    void rejectsAmbiguousOrUnboundedAttributeSelections() {
        var ids = List.of(UUID.randomUUID(), UUID.randomUUID());
        for (var codes : List.of(
                List.of("power_max", "power_max"),
                List.of(""),
                List.of("unknown code"),
                java.util.stream.IntStream.range(0, 51)
                        .mapToObj(i -> "attr_" + i)
                        .toList())) assertThrows(DomainException.class, () -> new ComparisonSelection(ids, codes));
    }
}
