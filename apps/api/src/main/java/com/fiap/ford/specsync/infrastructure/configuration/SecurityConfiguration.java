package com.fiap.ford.specsync.infrastructure.configuration;

import com.fiap.ford.specsync.domain.access.Role;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Authorisation of user requests. Authentication happens in the gateway ({@code apps/gateway}):
 * it verifies the browser's Identity Platform ID token (signature, revocation, verified Google
 * e-mail) and forwards the same token as {@code Authorization: Bearer}. This API never sees a
 * password or a login: it re-validates the forwarded JWT so it cannot be forged by anything that
 * reaches the service (signature against Google's public keys, issuer, audience, expiry, subject)
 * and then decides access from its claims.
 *
 * <ul>
 *   <li>{@code sub} becomes the principal name (the user's uid);
 *   <li>the {@code roles} custom claim becomes {@code ROLE_CURATOR} / {@code ROLE_ADMIN}; every
 *       valid token also carries {@code ROLE_USER};
 *   <li>{@code exp} bounds the token's life (one hour for Identity Platform, 60 s clock skew).
 * </ul>
 *
 * <p>This is the fallback chain for everything under {@code /api} that no more specific chain
 * matches: the curator surface ({@link IngestionConfiguration}) reuses the same decoder and
 * converter, while internal service endpoints keep their service credentials.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AuthProperties.class)
public class SecurityConfiguration {

    /** Claim that carries the operator-assigned roles (Identity Platform custom claim). */
    public static final String ROLES_CLAIM = "roles";

    private static final Logger LOG = LoggerFactory.getLogger(SecurityConfiguration.class);

    /** Read-only catalog endpoints anyone may call without a token. */
    static final String[] PUBLIC_GET = {
        "/api/greeting",
        "/api/vehicle-configurations",
        "/api/comparison-attributes",
        "/api/comparisons",
        "/api/vehicle-specifications"
    };

    /** API documentation (OpenAPI document and Swagger UI) and the servlet error page. */
    static final String[] PUBLIC_DOCUMENTATION = {"/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/error"};

    @Bean
    SecurityFilterChain securityFilterChain(
            final HttpSecurity http, final JwtAuthenticationConverter userTokenConverter) throws Exception {
        http.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Bearer tokens in a header, no cookies: there is no ambient credential to forge.
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.GET, PUBLIC_GET)
                        .permitAll()
                        .requestMatchers(PUBLIC_DOCUMENTATION)
                        .permitAll()
                        .requestMatchers("/api/me")
                        .hasRole(Role.USER.name())
                        .anyRequest()
                        .authenticated())
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(userTokenConverter))
                        .authenticationEntryPoint(ProblemResponses.unauthorized("A valid bearer token is required"))
                        .accessDeniedHandler(ProblemResponses.forbidden("Your roles do not allow this operation")))
                .exceptionHandling(handling -> handling.authenticationEntryPoint(
                                ProblemResponses.unauthorized("A valid bearer token is required"))
                        .accessDeniedHandler(ProblemResponses.forbidden("Your roles do not allow this operation")));
        return http.build();
    }

    /**
     * Verifies the forwarded Identity Platform ID token. Keys are fetched lazily from the JWKS URI
     * and cached, so startup needs no network and key rotation is picked up automatically.
     */
    @Bean
    JwtDecoder userTokenDecoder(final AuthProperties properties) {
        if (properties.firebaseProjectId().isBlank()) {
            LOG.warn("specsync.auth.firebase-project-id is not set: every user token will be rejected");
        }
        final var decoder = NimbusJwtDecoder.withJwkSetUri(properties.jwkSetUri())
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                .build();
        decoder.setJwtValidator(userTokenValidator(properties));
        return decoder;
    }

    /**
     * Claims a user token must carry, shared with the tests that sign their own tokens: not expired
     * and not used before its time (60 s skew), issued by this project's Identity Platform, meant
     * for this project, and naming a subject.
     */
    public static OAuth2TokenValidator<Jwt> userTokenValidator(final AuthProperties properties) {
        final var audience = properties.audience();
        return new DelegatingOAuth2TokenValidator<>(List.of(
                new JwtTimestampValidator(),
                new JwtClaimValidator<>(JwtClaimNames.EXP, Objects::nonNull),
                new JwtIssuerValidator(properties.issuer()),
                new JwtClaimValidator<List<String>>(
                        JwtClaimNames.AUD, aud -> !audience.isBlank() && aud != null && aud.contains(audience)),
                new JwtClaimValidator<String>(JwtClaimNames.SUB, sub -> sub != null && !sub.isBlank())));
    }

    /** {@code sub} is the principal; {@code roles} plus the implicit {@code USER} are the authorities. */
    @Bean
    JwtAuthenticationConverter userTokenConverter() {
        final var converter = new JwtAuthenticationConverter();
        converter.setPrincipalClaimName(JwtClaimNames.SUB);
        converter.setJwtGrantedAuthoritiesConverter(SecurityConfiguration::authorities);
        return converter;
    }

    static List<GrantedAuthority> authorities(final Jwt jwt) {
        final var claims = jwt.hasClaim(ROLES_CLAIM) ? jwt.getClaimAsStringList(ROLES_CLAIM) : List.<String>of();
        final var authorities = new ArrayList<GrantedAuthority>();
        for (final var role : Role.fromClaims(claims)) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role.name()));
        }
        return authorities;
    }

    /** ADMIN may do everything a CURATOR may, and a CURATOR everything a USER may. */
    @Bean
    static RoleHierarchy roleHierarchy() {
        return RoleHierarchyImpl.withDefaultRolePrefix()
                .role(Role.ADMIN.name())
                .implies(Role.CURATOR.name())
                .role(Role.CURATOR.name())
                .implies(Role.USER.name())
                .build();
    }
}
