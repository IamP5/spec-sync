package com.fiap.ford.specsync.testing;

import com.fiap.ford.specsync.infrastructure.configuration.AuthProperties;
import com.fiap.ford.specsync.infrastructure.configuration.SecurityConfiguration;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/**
 * Stands in for Identity Platform in tests: signs ID-token-shaped JWTs (RS256, issuer {@code
 * https://securetoken.google.com/test-project}, audience {@code test-project}) with a local key,
 * and {@link Keys} swaps the production decoder's JWKS lookup for that key while keeping the exact
 * production claim validation ({@link SecurityConfiguration#userTokenValidator}).
 */
public final class TestTokens {

    public static final String PROJECT = "test-project";
    public static final String ISSUER = "https://securetoken.google.com/" + PROJECT;

    private static final RSAKey SIGNING_KEY = generate("test-key");
    private static final RSAKey FOREIGN_KEY = generate("foreign-key");

    private TestTokens() {}

    /** A valid one-hour token for {@code uid} with the given {@code roles} claim values. */
    public static String user(final String uid, final String... roles) {
        return builder(uid).roles(roles).sign();
    }

    public static Builder builder(final String uid) {
        return new Builder(uid);
    }

    /** Decoder for the test key with the production validator. */
    public static JwtDecoder decoder() {
        final var decoder = NimbusJwtDecoder.withPublicKey(publicKey(SIGNING_KEY))
                .signatureAlgorithm(SignatureAlgorithm.RS256)
                .build();
        decoder.setJwtValidator(SecurityConfiguration.userTokenValidator(new AuthProperties(PROJECT, null)));
        return decoder;
    }

    /** Import next to {@code SecurityConfiguration} in slice tests that send real tokens. */
    @TestConfiguration(proxyBeanMethods = false)
    public static class Keys {

        @Bean
        @Primary
        JwtDecoder testUserTokenDecoder() {
            return decoder();
        }
    }

    public static final class Builder {

        private String subject;
        private List<String> roles = List.of();
        private String issuer = ISSUER;
        private String audience = PROJECT;
        private Instant issuedAt = Instant.now();
        private Duration lifetime = Duration.ofHours(1);
        private RSAKey key = SIGNING_KEY;

        private Builder(final String subject) {
            this.subject = subject;
        }

        public Builder roles(final String... values) {
            this.roles = List.of(values);
            return this;
        }

        public Builder issuer(final String value) {
            this.issuer = value;
            return this;
        }

        public Builder audience(final String value) {
            this.audience = value;
            return this;
        }

        public Builder subject(final String value) {
            this.subject = value;
            return this;
        }

        /** Issued two hours ago and expired one hour ago: beyond the 60 s clock skew. */
        public Builder expired() {
            this.issuedAt = Instant.now().minus(Duration.ofHours(2));
            this.lifetime = Duration.ofHours(1);
            return this;
        }

        /** Signed by a key that is not in the trusted key set, as a forged token would be. */
        public Builder foreignKey() {
            this.key = FOREIGN_KEY;
            return this;
        }

        public String sign() {
            final var claims = JwtClaimsSet.builder()
                    .issuer(issuer)
                    .audience(List.of(audience))
                    .issuedAt(issuedAt)
                    .expiresAt(issuedAt.plus(lifetime))
                    .claim("email", subject == null ? "anonymous@example.com" : subject + "@example.com")
                    .claim("email_verified", true)
                    .claim("roles", roles);
            if (subject != null) {
                claims.subject(subject);
            }
            final var encoder = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(key)));
            return encoder.encode(JwtEncoderParameters.from(
                            JwsHeader.with(SignatureAlgorithm.RS256)
                                    .keyId(key.getKeyID())
                                    .build(),
                            claims.build()))
                    .getTokenValue();
        }
    }

    private static RSAKey generate(final String keyId) {
        try {
            final var generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            final var pair = generator.generateKeyPair();
            return new RSAKey.Builder((RSAPublicKey) pair.getPublic())
                    .privateKey((RSAPrivateKey) pair.getPrivate())
                    .keyID(keyId)
                    .build();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static RSAPublicKey publicKey(final RSAKey key) {
        try {
            return key.toRSAPublicKey();
        } catch (com.nimbusds.jose.JOSEException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
