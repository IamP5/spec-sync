package com.fiap.ford.specsync.domain.research;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ResearchTest {
    private static Ingestion.Request request(String url, String brand, String model, int year, List<String> trims) {
        return new Ingestion.Request(url, brand, model, "BR", year, trims);
    }

    @Test
    void approvedFordWholeModelAliasesShareWorkWithoutRewritingTheRequest() {
        var original = request("https://example.com/f150.pdf", " Ford ", " F150 ", 2026, List.of("Lariat Black"));
        var canonical = request("https://example.com/f150.pdf", "ford", "f-150", 2026, List.of("Tremor"));

        assertEquals(Research.Scope.of(canonical, "br-v1"), Research.Scope.of(original, "br-v1"));
        assertEquals("f-150", Research.Scope.of(original, "br-v1").model());
        assertEquals(" Ford ", original.brand());
        assertEquals(" F150 ", original.model());
        assertEquals(List.of("Lariat Black"), original.configurations());
    }

    @Test
    void fordModelAliasDoesNotMergeOtherBrandsYearsOrModelNamesContainingTrims() {
        String source = "https://example.com/f150.pdf";
        var ford = Research.Scope.of(request(source, "Ford", "F150", 2026, List.of()), "br-v1");
        assertNotEquals(ford, Research.Scope.of(request(source, "Ford", "F-150", 2025, List.of()), "br-v1"));
        assertNotEquals(
                Research.Scope.of(request(source, "Other", "F150", 2026, List.of()), "br-v1"),
                Research.Scope.of(request(source, "Other", "F-150", 2026, List.of()), "br-v1"));
        assertNotEquals(
                Research.Scope.of(request(source, "Ford", "F150 Tremor", 2026, List.of()), "br-v1"),
                Research.Scope.of(request(source, "Ford", "F-150 Tremor", 2026, List.of()), "br-v1"));
        assertNotEquals(ford, Research.Scope.of(request(source, "Ford", "F150 Tremor", 2026, List.of()), "br-v1"));
        assertNotEquals(
                Research.Scope.of(request(source, "Ford", "F-150 Lariat Black", 2026, List.of()), "br-v1"),
                Research.Scope.of(request(source, "Ford", "F-150 Lariat Chrome", 2026, List.of()), "br-v1"));
        assertNotEquals(
                Research.Scope.of(request(source, "Ford", "F250", 2026, List.of()), "br-v1"),
                Research.Scope.of(request(source, "Ford", "F-250", 2026, List.of()), "br-v1"));
    }

    @Test
    void equivalentScopesIgnoreRequestedTrimAndFragmentButRetainTheExplicitYear() {
        var first = Research.Scope.of(
                request(
                        "https://EXAMPLE.com:443/Brochure?q=A%2fb#page=2",
                        " Ford ", "Ranger  Limited", 2026, List.of("V6")),
                "br-v1");
        var second = Research.Scope.of(
                request("https://example.com/Brochure?q=A%2fb", "ford", "ranger limited", 2026, List.of("XL")),
                "br-v1");
        assertEquals(first, second);
        assertNotEquals(
                first,
                Research.Scope.of(
                        request("https://example.com/Brochure?q=A%2fb", "ford", "ranger limited", 2025, List.of()),
                        "br-v1"));
    }

    @Test
    void distinctQueryPathAndPolicyNeverShareWork() {
        var input = request("https://example.com/Brochure?a=1&b=2", "Ford", "Ranger", 2026, List.of());
        var scope = Research.Scope.of(input, "br-v1");
        assertNotEquals(scope, Research.Scope.of(input, "br-v2"));
        assertNotEquals(
                scope,
                Research.Scope.of(
                        request("https://example.com/brochure?a=1&b=2", "Ford", "Ranger", 2026, List.of()), "br-v1"));
        assertNotEquals(
                scope,
                Research.Scope.of(
                        request("https://example.com/Brochure?b=2&a=1", "Ford", "Ranger", 2026, List.of()), "br-v1"));
    }

    @Test
    void emptyPathAndDefaultPortAreEquivalent() {
        assertEquals("https://example.com/", Research.normalizeUrl("https://EXAMPLE.com:443#fragment"));
        assertEquals("https://example.com:8443/?a=%2F", Research.normalizeUrl("https://EXAMPLE.com:8443?a=%2F"));
    }

    @Test
    void checkpointBoundsCountUtf8BytesAndRejectUnsafeKeys() {
        assertThrows(DomainException.class, () -> new Research.Checkpoint("../capture", "{}"));
        assertThrows(DomainException.class, () -> new Research.Checkpoint("capture-source", ""));
        assertThrows(DomainException.class, () -> new Research.Checkpoint("capture-source", "é".repeat(6_000_001)));
        assertEquals("{}", new Research.Checkpoint("extract-configuration-0", "{}").payload());
    }

    @Test
    void identityCannotBeMissingOrUnbounded() {
        assertThrows(DomainException.class, () -> Research.requireIdentity(UUID.randomUUID(), " "));
        assertThrows(DomainException.class, () -> Research.requireIdentity(UUID.randomUUID(), "a".repeat(129)));
        assertThrows(DomainException.class, () -> Research.requireIdentity(null, "user"));
    }

    @Test
    void publicSourceHasChecksumsWithoutRawCaptureContent() {
        var safe = Research.Source.from(new Ingestion.Source(
                "https://example.com",
                "Title",
                "application/pdf",
                "private-bytes",
                "sha-original",
                "source text",
                "sha-text",
                "parser"));
        assertEquals("sha-original", safe.originalSha256());
        assertEquals("sha-text", safe.textSha256());
        assertEquals(6, Research.Source.class.getRecordComponents().length);
    }
}
