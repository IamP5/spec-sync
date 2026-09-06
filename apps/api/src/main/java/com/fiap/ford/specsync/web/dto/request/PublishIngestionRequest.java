package com.fiap.ford.specsync.web.dto.request;

import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record PublishIngestionRequest(@NotNull @Valid Ingestion.Review review) {}
