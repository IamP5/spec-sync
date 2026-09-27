package com.fiap.ford.specsync.infrastructure.configuration;

import java.util.Base64;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Data key of the application-level field encryption: Base64 of exactly 32 random bytes (AES-256),
 * injected from Secret Manager. Blank keeps new values in plain text (local development).
 */
@ConfigurationProperties("specsync.field-encryption")
public record FieldEncryptionProperties(String key) {
    public FieldEncryptionProperties {
        if (key != null && !key.isBlank() && decode(key).length != 32) {
            throw new IllegalArgumentException("specsync.field-encryption.key must be Base64 of 32 bytes");
        }
    }

    public boolean enabled() {
        return key != null && !key.isBlank();
    }

    byte[] bytes() {
        return decode(key);
    }

    private static byte[] decode(final String value) {
        try {
            return Base64.getDecoder().decode(value.strip());
        } catch (IllegalArgumentException malformed) {
            throw new IllegalArgumentException("specsync.field-encryption.key must be Base64 of 32 bytes");
        }
    }
}
