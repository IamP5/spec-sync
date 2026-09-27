package com.fiap.ford.specsync.infrastructure.configuration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

class FirebaseJwtTest {
    private static final String PROJECT = "specsync-dev";

    @Test
    void acceptsAVerifiedGoogleIdentityOfTheProject() {
        assertThat(FirebaseJwt.validator(PROJECT).validate(token(claims -> {})).hasErrors())
                .isFalse();
    }

    @Test
    void rejectsTokensOfAnotherIssuerOrAudience() {
        assertThat(FirebaseJwt.validator(PROJECT)
                        .validate(token(c -> c.put("iss", "https://securetoken.google.com/other")))
                        .hasErrors())
                .isTrue();
        assertThat(FirebaseJwt.validator(PROJECT)
                        .validate(token(c -> c.put("aud", List.of("other"))))
                        .hasErrors())
                .isTrue();
    }

    @Test
    void rejectsExpiredOrUnverifiedIdentities() {
        assertThat(FirebaseJwt.validator(PROJECT)
                        .validate(token(c -> {
                            c.put("iat", Instant.now().minusSeconds(7200));
                            c.put("exp", Instant.now().minusSeconds(3600));
                        }))
                        .hasErrors())
                .isTrue();
        assertThat(FirebaseJwt.validator(PROJECT)
                        .validate(token(c -> c.put("email_verified", false)))
                        .hasErrors())
                .isTrue();
        assertThat(FirebaseJwt.validator(PROJECT)
                        .validate(token(c -> c.put("firebase", Map.of("sign_in_provider", "password"))))
                        .hasErrors())
                .isTrue();
    }

    @Test
    void grantsAnalystToEveryUserAndOnlyKnownProfilesFromTheRolesClaim() {
        assertThat(roles(token(c -> {}))).containsExactly("ROLE_ANALYST");
        assertThat(roles(token(c -> c.put("roles", List.of("reviewer", "admin", "root", "ADMIN", "reviewer")))))
                .containsExactly("ROLE_ANALYST", "ROLE_REVIEWER", "ROLE_ADMIN");
        assertThat(roles(token(c -> c.put("roles", "admin")))).containsExactly("ROLE_ANALYST");
    }

    private static List<String> roles(final Jwt jwt) {
        return FirebaseJwt.authorities(jwt).stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
    }

    private static Jwt token(final Consumer<Map<String, Object>> customize) {
        final var now = Instant.now();
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .issuer("https://securetoken.google.com/" + PROJECT)
                .audience(List.of(PROJECT))
                .subject("uid-123")
                .issuedAt(now.minusSeconds(60))
                .expiresAt(now.plusSeconds(3000))
                .claim("email_verified", true)
                .claim("firebase", Map.of("sign_in_provider", "google.com"))
                .claims(customize)
                .build();
    }
}
