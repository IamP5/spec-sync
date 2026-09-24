package com.fiap.ford.specsync.infrastructure.configuration;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;

/**
 * Verification of the Firebase ID token the gateway forwards in {@code X-SpecSync-Token}, and the
 * mapping of its {@code roles} claim to the API profiles. Every verified user is an analyst;
 * {@code reviewer} and {@code admin} are granted through Firebase custom claims only.
 */
final class FirebaseJwt {

    static final String HEADER = "X-SpecSync-Token";

    private static final String JWK_SET_URI =
            "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
    private static final Pattern ROLE = Pattern.compile("^[a-z][a-z0-9:_-]{0,63}$");
    private static final Map<String, String> PROFILES = Map.of("reviewer", "ROLE_REVIEWER", "admin", "ROLE_ADMIN");

    private FirebaseJwt() {}

    static JwtDecoder decoder(final String projectId) {
        final var decoder = NimbusJwtDecoder.withJwkSetUri(JWK_SET_URI)
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                .build();
        decoder.setJwtValidator(validator(projectId));
        return decoder;
    }

    /** Signature, {@code exp}/{@code nbf} and issuer, plus the same identity rules as the gateway. */
    static OAuth2TokenValidator<Jwt> validator(final String projectId) {
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer("https://securetoken.google.com/" + projectId),
                new JwtClaimValidator<List<String>>("aud", aud -> aud != null && aud.contains(projectId)),
                new JwtClaimValidator<Boolean>("email_verified", Boolean.TRUE::equals),
                new JwtClaimValidator<Map<String, Object>>(
                        "firebase",
                        firebase -> firebase != null && "google.com".equals(firebase.get("sign_in_provider"))));
    }

    static JwtAuthenticationConverter authenticationConverter() {
        final var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(FirebaseJwt::authorities);
        return converter;
    }

    static Collection<GrantedAuthority> authorities(final Jwt jwt) {
        final var authorities = new ArrayList<GrantedAuthority>();
        authorities.add(new SimpleGrantedAuthority("ROLE_ANALYST"));
        if (jwt.getClaims().get("roles") instanceof List<?> roles && roles.size() <= 32) {
            roles.stream()
                    .filter(role ->
                            role instanceof String name && ROLE.matcher(name).matches())
                    .map(PROFILES::get)
                    .filter(Objects::nonNull)
                    .distinct()
                    .map(SimpleGrantedAuthority::new)
                    .forEach(authorities::add);
        }
        return authorities;
    }
}
