package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.domain.research.Research;
import java.util.List;

public record ResearchListResponse(List<Research.Summary> requests) {}
