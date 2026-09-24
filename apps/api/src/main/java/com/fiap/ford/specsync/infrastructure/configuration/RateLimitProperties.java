package com.fiap.ford.specsync.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Per-instance request budget of every caller on the public and curation surfaces. */
@ConfigurationProperties("specsync.rate-limit")
public record RateLimitProperties(Boolean enabled, Integer requestsPerMinute) {
    public RateLimitProperties {
        enabled = enabled == null || enabled;
        requestsPerMinute = requestsPerMinute == null ? 300 : requestsPerMinute;
        if (requestsPerMinute < 1) {
            throw new IllegalArgumentException("specsync.rate-limit.requests-per-minute must be positive");
        }
    }
}
