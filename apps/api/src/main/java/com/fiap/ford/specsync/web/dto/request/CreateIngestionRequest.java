package com.fiap.ford.specsync.web.dto.request;

import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateIngestionRequest(
        @NotNull UUID id, @NotNull @Valid Ingestion.Request request) {}
