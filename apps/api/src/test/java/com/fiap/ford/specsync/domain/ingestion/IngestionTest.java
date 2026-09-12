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
    void readsBrazilianGroupingAndDecimalNotation() {
        assertEquals(new BigDecimal("1200.5"), Ingestion.normalizeNumber("1.200,5", "mm", "mm"));
        assertEquals(new BigDecimal("3270"), Ingestion.normalizeNumber("3.270", "mm", "mm"));
        assertEquals(new BigDecimal("2998"), Ingestion.normalizeNumber("2.998", "cm³", "cm3"));
        assertEquals(new BigDecimal("80"), Ingestion.normalizeNumber("80", "litros", "L"));
        assertEquals(new BigDecimal("2.5"), Ingestion.normalizeNumber("2.5", "L", "L"));
    }

    @Test
    void refusesAmbiguousNumbersAndUnits() {
        for (String value : List.of("500-600", "60 at 2000 rpm", "—", "NaN", "1.2345", "1,200,5"))
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
        String hash = "a".repeat(64);
        assertThrows(
                DomainException.class,
                () -> new Ingestion.Review(
                        hash, 0, List.of(new Ingestion.ConfigurationReview(0, List.of(0), false)), "checked"));
        assertThrows(
                DomainException.class,
                () -> new Ingestion.Review(
                        hash, 0, List.of(new Ingestion.ConfigurationReview(0, List.of(0, 0), true)), "checked"));
        assertThrows(
                DomainException.class,
                () -> new Ingestion.Review(
                        hash,
                        0,
                        List.of(
                                new Ingestion.ConfigurationReview(0, List.of(0), true),
                                new Ingestion.ConfigurationReview(0, List.of(1), true)),
                        "checked"));
        assertThrows(
                DomainException.class,
                () -> new Ingestion.Review(
                        hash, 0, List.of(new Ingestion.ConfigurationReview(0, List.of(), false)), "checked"));
        var review = new Ingestion.Review(
                hash,
                0,
                List.of(
                        new Ingestion.ConfigurationReview(0, List.of(0), true),
                        new Ingestion.ConfigurationReview(1, List.of(), false)),
                "checked");
        assertEquals(2, review.configurations().size());
    }

    @Test
    void recordsAConfigurationReasonWithoutReplacingTheReviewReason() {
        String hash = "a".repeat(64);
        var own = new Ingestion.ConfigurationReview(0, List.of(0), true, "  Trail brochure names this package  ");
        var inherited = new Ingestion.ConfigurationReview(1, List.of(0), true, "   ");
        var review = new Ingestion.Review(hash, 0, List.of(own, inherited), "checked");
        assertEquals("Trail brochure names this package", review.reasonFor(own));
        assertNull(inherited.reason());
        assertEquals("checked", review.reasonFor(inherited));
        assertThrows(
                DomainException.class, () -> new Ingestion.ConfigurationReview(0, List.of(0), true, "x".repeat(2001)));
    }

    @Test
    void publishesTheRestOfADraftButNeverAnAttributeTwice() {
        String hash = "a".repeat(64);
        var draft = new Ingestion.Draft(
                null,
                List.of(
                        configuration("Limited", "torque_max", "torque_max", "payload"),
                        configuration("XLT", "torque_max")),
                List.of());
        var first =
                new Ingestion.Review(hash, 0, List.of(new Ingestion.ConfigurationReview(0, List.of(0), true)), "first");
        var rest = new Ingestion.Review(
                hash,
                1,
                List.of(
                        new Ingestion.ConfigurationReview(0, List.of(2), true),
                        new Ingestion.ConfigurationReview(1, List.of(0), true)),
                "rest");
        var otherCandidate =
                new Ingestion.Review(hash, 1, List.of(new Ingestion.ConfigurationReview(0, List.of(1), true)), "again");
        Ingestion.requireUnpublished(draft, List.of(), first);
        Ingestion.requireUnpublished(draft, List.of(first), rest);
        assertThrows(DomainException.class, () -> Ingestion.requireUnpublished(draft, List.of(first), otherCandidate));
        assertThrows(DomainException.class, () -> Ingestion.requireUnpublished(draft, List.of(first), first));
    }

    private static Ingestion.ConfigurationDraft configuration(String name, String... attributes) {
        return new Ingestion.ConfigurationDraft(
                name,
                1,
                1,
                name,
                java.util.Arrays.stream(attributes)
                        .map(code -> new Ingestion.Claim(
                                code,
                                code,
                                "Nm",
                                "60",
                                "Nm",
                                null,
                                null,
                                java.util.Map.of(),
                                2,
                                2,
                                "60 Nm",
                                "row",
                                new BigDecimal("60"),
                                List.of()))
                        .toList(),
                List.of());
    }

    @Test
    void boundsRequestedConfigurations() {
        var request = new Ingestion.Request("https://www.ford.com.br/x", "Ford", "Ranger", "BR", 2026, null);
        assertEquals(List.of(), request.configurations());
        assertThrows(
                DomainException.class,
                () -> new Ingestion.Request(
                        "https://www.ford.com.br/x", "Ford", "Ranger", "BR", 2026, List.of("XLS", "xls")));
        assertThrows(
                DomainException.class,
                () -> new Ingestion.Request(
                        "https://www.ford.com.br/x",
                        "Ford",
                        "Ranger",
                        "BR",
                        2026,
                        List.of("1", "2", "3", "4", "5", "6", "7", "8", "9")));
    }
}
