package com.fiap.ford.specsync.domain.knowledge;

import com.fiap.ford.specsync.domain.shared.ValueObject;
import java.util.List;
import java.util.Map;

public record KnowledgeResult(String status, String message, String projectionVersion, List<Map<String, Object>> items)
        implements ValueObject {}
