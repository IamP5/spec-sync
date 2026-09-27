package com.fiap.ford.specsync.infrastructure.configuration;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties({IngestionProperties.class, JwtProperties.class})
@EnableScheduling
public class IngestionConfiguration {
    /** Profiles: analyst (every verified user) < reviewer (curation) < admin (ontology changes). */
    @Bean
    static RoleHierarchy roleHierarchy() {
        return RoleHierarchyImpl.withDefaultRolePrefix()
                .role("ADMIN")
                .implies("REVIEWER")
                .role("REVIEWER")
                .implies("ANALYST")
                .build();
    }

    @Bean
    @Order(1)
    public SecurityFilterChain ingestionSecurity(HttpSecurity http, IngestionProperties properties, JwtProperties jwt)
            throws Exception {
        http.securityMatcher("/api/ingestions/**", "/api/ontology/**")
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(c -> c.ignoringRequestMatchers("/api/ingestions/**", "/api/ontology/**"))
                .exceptionHandling(e -> e.authenticationEntryPoint((request, response, ex) -> {
                    response.setStatus(401);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"detail\":\"Curator authentication required\"}");
                }));
        if (jwt.enabled()) {
            // RBAC on the user's own verified token; the shared curator key is no longer accepted.
            http.authorizeHttpRequests(a -> a.requestMatchers(HttpMethod.POST, "/api/ontology/proposals/*/activate")
                            .hasRole("ADMIN")
                            .anyRequest()
                            .hasRole("REVIEWER"))
                    .oauth2ResourceServer(o -> o.bearerTokenResolver(request -> request.getHeader(FirebaseJwt.HEADER))
                            .jwt(j -> j.decoder(FirebaseJwt.decoder(jwt.projectId()))
                                    .jwtAuthenticationConverter(FirebaseJwt.authenticationConverter())));
            return http.build();
        }
        http.authorizeHttpRequests(a -> a.anyRequest().hasRole("INGESTION"))
                .addFilterBefore(
                        new OncePerRequestFilter() {
                            @Override
                            protected void doFilterInternal(
                                    HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                                    throws ServletException, IOException {
                                String key = properties.reviewerKey(), supplied = request.getHeader("X-Ingestion-Key");
                                if (properties.enabled()
                                        && key != null
                                        && key.length() >= 32
                                        && supplied != null
                                        && MessageDigest.isEqual(
                                                key.getBytes(StandardCharsets.UTF_8),
                                                supplied.getBytes(StandardCharsets.UTF_8))) {
                                    var context = SecurityContextHolder.createEmptyContext();
                                    context.setAuthentication(new UsernamePasswordAuthenticationToken(
                                            "curator", null, List.of(new SimpleGrantedAuthority("ROLE_INGESTION"))));
                                    SecurityContextHolder.setContext(context);
                                }
                                chain.doFilter(request, response);
                            }
                        },
                        AnonymousAuthenticationFilter.class);
        return http.build();
    }
}
