package com.fiap.ford.specsync.domain.ingestion;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class IngestionTest {
    @Test
    void convertsTorqueWithoutInventingPrecision() {
        assertEquals(new BigDecimal("588.399000"), Ingestion.normalizeNumber("60,0", "kgf.m", "Nm"));
    }

    @Test
    void distinguishesMetricAndMechanicalHorsepower() {
        assertNotEquals(Ingestion.normalizeNumber("100", "cv", "kW"), Ingestion.normalizeNumber("100", "hp", "kW"));
    }

    @Test
    void refusesAmbiguousNumbersAndUnits() {
        for (String value : List.of("1.200,5", "500-600", "60 at 2000 rpm", "—", "NaN"))
            assertThrows(DomainException.class, () -> Ingestion.normalizeNumber(value, "Nm", "Nm"));
        assertThrows(DomainException.class, () -> Ingestion.normalizeNumber("60", null, "Nm"));
    }

    @Test
    void verifiesExactEvidenceBounds() {
        assertTrue(Ingestion.exactExcerpt("header\nvalue\nfootnote", 2, 3, "value\nfootnote"));
        assertFalse(Ingestion.exactExcerpt("value", 0, 1, "value"));
        assertFalse(Ingestion.exactExcerpt("value", 1, 2, "value"));
        assertFalse(Ingestion.exactExcerpt("value", 1, 1, "invented"));
    }

    @Test
    void requiresIdentityConfirmationAndUniqueSelections() {
        assertThrows(
                DomainException.class, () -> new Ingestion.Review("a".repeat(64), 0, List.of(0), false, "checked"));
        assertThrows(
                DomainException.class, () -> new Ingestion.Review("a".repeat(64), 0, List.of(0, 0), true, "checked"));
    }
}
