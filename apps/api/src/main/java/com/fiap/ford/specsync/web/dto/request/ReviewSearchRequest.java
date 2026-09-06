package com.fiap.ford.specsync.web.dto.request;

import java.util.List;
import java.util.UUID;

public record ReviewSearchRequest(
        String q, UUID configurationId, String attributeCode, Integer limit, List<Double> embedding) {}
