package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import java.util.List;

public record IngestionListResponse(List<Ingestion.Summary> result) {}
