package com.fiap.ford.specsync.domain.catalog;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import org.junit.jupiter.api.Test;

class CatalogSearchTest {
    @Test
    void normalizesTextWithoutTreatingWildcardsAsCommands() {
        assertEquals("Ranger %_", new CatalogSearch("  Ranger %_  ", "BR", 2026, 20, 0).query());
        assertEquals("", new CatalogSearch(null, null, null, 100, 0).query());
    }

    @Test
    void boundsEveryFilter() {
        assertThrows(DomainException.class, () -> new CatalogSearch("x".repeat(101), null, null, 20, 0));
        assertThrows(DomainException.class, () -> new CatalogSearch("", "br", null, 20, 0));
        assertThrows(DomainException.class, () -> new CatalogSearch("", null, 2300, 20, 0));
        assertThrows(DomainException.class, () -> new CatalogSearch("", null, null, 0, 0));
        assertThrows(DomainException.class, () -> new CatalogSearch("", null, null, 101, 0));
        assertThrows(DomainException.class, () -> new CatalogSearch("", null, null, 20, -1));
        assertThrows(DomainException.class, () -> new CatalogSearch("", null, null, 20, 100001));
    }
}
