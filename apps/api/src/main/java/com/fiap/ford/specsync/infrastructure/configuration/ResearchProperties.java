package com.fiap.ford.specsync.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("specsync.research")
public record ResearchProperties(String serviceKey, String policyVersion) {
    public ResearchProperties {
        policyVersion = policyVersion == null || policyVersion.isBlank() ? "br-v1" : policyVersion;
    }

    public boolean enabled() {
        return serviceKey != null && serviceKey.length() >= 32;
    }
}
