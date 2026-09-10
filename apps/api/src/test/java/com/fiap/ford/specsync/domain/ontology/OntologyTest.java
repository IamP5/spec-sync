package com.fiap.ford.specsync.domain.ontology;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import java.util.*;
import org.junit.jupiter.api.Test;

class OntologyTest {
    private Ontology.Context context(List<Ontology.Term> terms, List<Ontology.AttributeValue> values) {
        return new Ontology.Context(3, Ontology.NORMALIZATION_REVISION, List.of(), terms, values);
    }

    private Ontology.Observation observation(String term) {
        return new Ontology.Observation(
                term, "10", "kg", Map.of(), 1, 1, term + ": 10 kg", "row 1", null, "SOURCE_TEXT");
    }

    private Ingestion.Request request(String brand, String model, int year) {
        return new Ingestion.Request("https://www.ford.com.br/source", brand, model, "BR", year, List.of());
    }

    @Test
    void acceptsTheTwoOriginalLabelReaderRevisionsOnly() {
        assertTrue(Ontology.retainsOriginalTerms("specsync-visual-pdf-evidence-v5:model"));
        assertTrue(Ontology.retainsOriginalTerms("specsync-visual-pdf-evidence-v6:model"));
        assertFalse(Ontology.retainsOriginalTerms("specsync-visual-pdf-evidence-v4:model"));
        assertFalse(Ontology.retainsOriginalTerms("specsync-visual-pdf-evidence-v7:model"));
        assertFalse(Ontology.retainsOriginalTerms(null));
    }

    @Test
    void retainsOnlyOriginalDocumentLabelsNotLegacyEnglishParaphrases() {
        var v4 = new Ingestion.Source(
                "https://www.ford.com.br/source.pdf",
                "Ford",
                "application/pdf",
                null,
                "sha",
                "Towing capacity: 3492 kg",
                "textsha",
                "specsync-visual-pdf-evidence-v4:model");
        assertNull(Ontology.originalTerm(v4, "Towing capacity: 3492 kg", "Towing capacity"));
        var v5 = new Ingestion.Source(
                v4.url(),
                v4.title(),
                v4.mimeType(),
                null,
                v4.originalSha256(),
                v4.text(),
                v4.textSha256(),
                "specsync-visual-pdf-evidence-v5:model");
        assertEquals(
                "Capacidade de reboque",
                Ontology.originalTerm(
                        v5,
                        "Towing capacity: 3492 kg [originalTerm: Capacidade de reboque; originalValue: 3492 kg]",
                        "Capacidade de reboque"));
        assertNull(Ontology.originalTerm(v5, "Towing capacity: 3492 kg", "Towing capacity"));
    }

    @Test
    void normalizesFordModelSpellingWithoutMergingTrimsOrBrands() {
        assertEquals("f-150", Ontology.modelKey("Ford", " F150 "));
        assertEquals("f150", Ontology.modelKey("Other", "F150"));
        assertNotEquals(Ontology.modelKey("Ford", "Lariat Black"), Ontology.modelKey("Ford", "Lariat Chrome"));
    }

    @Test
    void resolvesOnlyApplicableManufacturerTerminology() {
        var context = context(
                List.of(new Ontology.Term(
                        "towing_capacity", "Capacidade de reboque", "ford", "f-150", "BR", "pt-BR", 2026)),
                List.of());
        assertEquals(
                Optional.of("towing_capacity"),
                Ontology.resolve(context, request("Ford", "F150", 2026), observation("CAPACIDADE DE REBOQUE")));
        assertTrue(Ontology.resolve(context, request("RAM", "1500", 2026), observation("Capacidade de reboque"))
                .isEmpty());
        assertTrue(Ontology.resolve(context, request("Ford", "F-150", 2025), observation("Capacidade de reboque"))
                .isEmpty());
        assertTrue(Ontology.resolve(context, request("Ford", "F-150", 2026), observation("Capacidade de carga"))
                .isEmpty());
    }

    @Test
    void keepsAmbiguousMappingsUnresolved() {
        var terms = List.of(
                new Ontology.Term("payload", "capacity", null, null, null, null, null),
                new Ontology.Term("towing_capacity", "capacity", "ford", null, "BR", null, null));
        assertTrue(Ontology.resolve(context(terms, List.of()), request("Ford", "F-150", 2026), observation("capacity"))
                .isEmpty());
    }

    @Test
    void preservesFuelCombinationsAndUsesThePinnedVocabulary() {
        var gasoline = new Ontology.AttributeValue("fuel_type", "GASOLINE", List.of("gasolina", "gasoline"));
        var ethanol = new Ontology.AttributeValue("fuel_type", "ETHANOL", List.of("etanol", "ethanol"));
        var before = context(List.of(), List.of(gasoline, ethanol));
        assertEquals(
                List.of("GASOLINE", "ETHANOL"),
                Ontology.normalizeVocabulary(before, "fuel_type", List.of("Gasolina", "Etanol", "gasoline")));
        assertThrows(DomainException.class, () -> Ontology.normalizeVocabulary(before, "fuel_type", List.of("Hybrid")));
        assertThrows(
                DomainException.class, () -> Ontology.normalizeVocabulary(before, "fuel_type", List.of("Biodiesel")));
        var after = context(
                List.of(),
                List.of(
                        gasoline,
                        ethanol,
                        new Ontology.AttributeValue("fuel_type", "BIODIESEL", List.of("biodiesel"))));
        assertEquals(List.of("BIODIESEL"), Ontology.normalizeVocabulary(after, "fuel_type", List.of("Biodiesel")));
    }
}
