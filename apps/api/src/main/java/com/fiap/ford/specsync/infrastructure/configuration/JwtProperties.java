package com.fiap.ford.specsync.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Firebase project whose ID tokens the API verifies itself (defence in depth behind the gateway).
 * Blank keeps the legacy curator key as the only credential of the curation endpoints.
 */
@ConfigurationProperties("specsync.security.jwt")
public record JwtProperties(String projectId) {
    public boolean enabled() {
        return projectId != null && !projectId.isBlank();
    }
}
