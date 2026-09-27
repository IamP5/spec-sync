package com.fiap.ford.specsync.infrastructure.configuration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fiap.ford.specsync.testing.TestTokens;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * The JWT rules of {@link SecurityConfiguration}, without Spring: which forwarded tokens the API
 * accepts and which authorities their claims become.
 */
class UserTokenValidationTest {

    private final org.springframework.security.oauth2.jwt.JwtDecoder decoder = TestTokens.decoder();

    @Test
    void acceptsAValidTokenAndReadsItsClaims() {
        final var jwt = decoder.decode(TestTokens.user("uid-1", "curator"));

        assertEquals("uid-1", jwt.getSubject());
        assertEquals(List.of("curator"), jwt.getClaimAsStringList("roles"));
        assertEquals(TestTokens.ISSUER, jwt.getIssuer().toString());
    }

    @Test
    void rejectsAnExpiredToken() {
        final var token = TestTokens.builder("uid-1").expired().sign();

        final var failure = assertThrows(JwtValidationException.class, () -> decoder.decode(token));
        assertEquals(true, failure.getMessage().contains("expired"));
    }

    @Test
    void rejectsATokenSignedByAnUntrustedKey() {
        final var token = TestTokens.builder("uid-1").foreignKey().sign();

        assertThrows(BadJwtException.class, () -> decoder.decode(token));
    }

    @Test
    void rejectsATokenOfAnotherIdentityPlatformProject() {
        final var token = TestTokens.builder("uid-1")
                .issuer("https://securetoken.google.com/other-project")
                .sign();

        assertThrows(JwtValidationException.class, () -> decoder.decode(token));
    }

    @Test
    void rejectsATokenMeantForAnotherAudience() {
        final var token = TestTokens.builder("uid-1").audience("other-project").sign();

        assertThrows(JwtValidationException.class, () -> decoder.decode(token));
    }

    @Test
    void rejectsATokenWithoutSubject() {
        final var token = TestTokens.builder(null).sign();

        assertThrows(JwtValidationException.class, () -> decoder.decode(token));
    }

    @Test
    void rejectsEveryTokenWhenNoProjectIsConfigured() {
        final var validator = SecurityConfiguration.userTokenValidator(new AuthProperties("", null));
        final var jwt = decoder.decode(TestTokens.user("uid-1"));

        assertEquals(true, validator.validate(jwt).hasErrors());
    }

    @Test
    void mapsTheRolesClaimToAuthoritiesWithAnImplicitUser() {
        final var jwt = decoder.decode(TestTokens.user("uid-1", "admin", "unknown-role"));

        final var authentication = (JwtAuthenticationToken)
                new SecurityConfiguration().userTokenConverter().convert(jwt);

        assertEquals("uid-1", authentication.getName());
        assertEquals(
                List.of("ROLE_USER", "ROLE_ADMIN"),
                authentication.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        // Spring Security 7 also records how the caller proved itself (FACTOR_BEARER).
                        .filter(authority -> authority.startsWith("ROLE_"))
                        .toList());
    }
}
