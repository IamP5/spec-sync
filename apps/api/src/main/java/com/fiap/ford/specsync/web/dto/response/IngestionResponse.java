package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.domain.ingestion.Ingestion;

public record IngestionResponse(Ingestion.Run result) {}
