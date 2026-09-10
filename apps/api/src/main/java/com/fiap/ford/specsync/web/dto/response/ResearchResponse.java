package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import com.fiap.ford.specsync.domain.research.Research;
import java.time.Instant;
import java.util.*;

public record ResearchResponse(
        UUID id,
        UUID workId,
        String requestStatus,
        String disposition,
        Ingestion.Request request,
        String status,
        int attempts,
        String stage,
        List<Ingestion.ConfigurationDraft> configurations,
        List<String> warnings,
        String error,
        Research.Source source,
        Map<String, UUID> configurationIds,
        Instant createdAt,
        Instant updatedAt,
        long ontologyRevision,
        String normalizationRevision,
        UUID replayedFromWorkId) {
    public static ResearchResponse from(Research.Snapshot value) {
        return new ResearchResponse(
                value.id(),
                value.workId(),
                value.requestStatus(),
                value.disposition(),
                value.request(),
                value.status(),
                value.attempts(),
                value.stage(),
                value.configurations(),
                value.warnings(),
                value.error(),
                value.source(),
                value.configurationIds(),
                value.createdAt(),
                value.updatedAt(),
                value.ontologyRevision(),
                value.normalizationRevision(),
                value.replayedFromWorkId());
    }
}
