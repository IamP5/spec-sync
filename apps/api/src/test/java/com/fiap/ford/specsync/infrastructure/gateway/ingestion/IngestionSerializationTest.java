package com.fiap.ford.specsync.infrastructure.gateway.ingestion;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class IngestionSerializationTest {
    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void retainsAnOlderPinnedContextWithoutAddingCurrentVocabulary() {
        var context = json.readValue(
                "{\"ontologyRevision\":1,\"normalizationRevision\":\"numeric-v3\",\"attributes\":[]}",
                com.fiap.ford.specsync.domain.ontology.Ontology.Context.class);
        assertEquals(1, context.ontologyRevision());
        assertEquals(List.of(), context.terminology());
        assertEquals(List.of(), context.attributeValues());
    }

    @Test
    void readsLegacyPersistedDraftsWithoutOntologyMetadataOrUnmappedObservations() {
        var draft = json.readValue("""
                {"source":{"url":"https://www.ford.com.br/source.pdf","title":"Ford","mimeType":"application/pdf","originalSha256":"original","text":"Ford Ranger","textSha256":"text","parserVersion":"specsync-visual-pdf-evidence-v4:model"},
                "configurations":[{"name":"Limited","identityLineStart":1,"identityLineEnd":1,"identityExcerpt":"Ford Ranger","warnings":[],"claims":[{"attributeCode":"torque_max","rawValue":"60","rawUnit":"kgf.m","lineStart":1,"lineEnd":1,"excerpt":"Ford Ranger","locator":"row 1","issues":[]}]}],"warnings":[]}
                """, Ingestion.Draft.class);
        assertEquals(0, draft.ontologyRevision());
        assertNull(draft.normalizationRevision());
        assertNull(draft.readerRevision());
        assertEquals(List.of(), draft.configurations().getFirst().unmappedObservations());
        assertNull(draft.configurations().getFirst().claims().getFirst().originalTerm());
    }
}
