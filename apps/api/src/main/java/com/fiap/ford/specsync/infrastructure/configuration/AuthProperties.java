package com.fiap.ford.specsync.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Where user tokens come from. The gateway authenticates the browser with Identity Platform
 * (Firebase Auth) and forwards the verified ID token; this API only validates it and authorises.
 *
 * @param firebaseProjectId Google Cloud project of the Identity Platform tenant: the token's
 *     audience and the suffix of its issuer. Blank rejects every user token (fail closed).
 * @param jwkSetUri public keys that sign the tokens (Google's securetoken JWKS by default)
 */
@ConfigurationProperties("specsync.auth")
public record AuthProperties(String firebaseProjectId, String jwkSetUri) {

    public static final String GOOGLE_SECURETOKEN_JWKS =
            "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

    public AuthProperties {
        firebaseProjectId = firebaseProjectId == null ? "" : firebaseProjectId.trim();
        jwkSetUri = jwkSetUri == null || jwkSetUri.isBlank() ? GOOGLE_SECURETOKEN_JWKS : jwkSetUri;
    }

    /** Identity Platform issues tokens as {@code https://securetoken.google.com/<project>}. */
    public String issuer() {
        return "https://securetoken.google.com/" + firebaseProjectId;
    }

    public String audience() {
        return firebaseProjectId;
    }
}
