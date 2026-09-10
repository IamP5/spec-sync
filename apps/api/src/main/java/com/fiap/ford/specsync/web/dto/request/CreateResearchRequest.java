package com.fiap.ford.specsync.web.dto.request;

import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateResearchRequest(
        @NotNull UUID id, @NotNull Ingestion.Request request) {}
