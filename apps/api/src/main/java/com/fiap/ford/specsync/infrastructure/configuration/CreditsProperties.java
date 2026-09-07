package com.fiap.ford.specsync.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Shared secret the AI service authenticates the internal wallet endpoints with. Credits are
 * enabled exactly when this key is set and long enough; an unset or short key rejects every call.
 */
@ConfigurationProperties("specsync.credits")
public record CreditsProperties(String serviceKey) {

    /** Shortest key accepted: anything shorter is treated as unset, never as a weak secret. */
    public static final int MINIMUM_KEY_LENGTH = 32;

    public boolean enabled() {
        return serviceKey != null && serviceKey.length() >= MINIMUM_KEY_LENGTH;
    }
}
