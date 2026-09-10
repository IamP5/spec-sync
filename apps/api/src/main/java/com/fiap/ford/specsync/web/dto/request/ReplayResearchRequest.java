package com.fiap.ford.specsync.web.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ReplayResearchRequest(@NotNull UUID id) {}
