package com.fiap.ford.specsync.infrastructure.configuration;

import com.fiap.ford.specsync.domain.access.Role;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Curator surface: vehicle ingestion review and ontology activation. The caller is the user the
 * gateway authenticated; access needs the {@code curator} role (or {@code admin}, which implies it)
 * in the verified token, validated exactly like every other user request ({@link
 * SecurityConfiguration}). While ingestion is disabled the surface is closed for everyone.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(IngestionProperties.class)
@EnableScheduling
public class IngestionConfiguration {

    static final String[] PATHS = {"/api/ingestions/**", "/api/ontology/**"};

    @Bean
    @Order(1)
    SecurityFilterChain ingestionSecurity(
            final HttpSecurity http,
            final IngestionProperties properties,
            final JwtAuthenticationConverter userTokenConverter)
            throws Exception {
        final var unauthorized = ProblemResponses.unauthorized("Curator authentication required");
        final var forbidden = ProblemResponses.forbidden(
                properties.enabled() ? "The curator role is required" : "Vehicle ingestion is disabled");
        http.securityMatcher(PATHS)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authorize -> {
                    if (properties.enabled()) {
                        authorize.anyRequest().hasRole(Role.CURATOR.name());
                    } else {
                        authorize.anyRequest().denyAll();
                    }
                })
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(userTokenConverter))
                        .authenticationEntryPoint(unauthorized)
                        .accessDeniedHandler(forbidden))
                .exceptionHandling(handling ->
                        handling.authenticationEntryPoint(unauthorized).accessDeniedHandler(forbidden));
        return http.build();
    }
}
