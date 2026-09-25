package com.fiap.ford.specsync.infrastructure.configuration;

import com.google.auth.oauth2.TokenVerifier;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Secures the scheduler-driven ingestion worker. Cloud Scheduler calls it with a Google ID token of
 * its own service account; Cloud Run's IAM check passes the {@code Authorization} header through
 * unchanged, and this chain verifies it again because the gateway proxies every {@code /api/**}
 * path to this service.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(IngestionProperties.class)
public class IngestionWorkerConfiguration {

    /** Base path of the worker trigger; everything below it needs {@code ROLE_INGESTION_WORKER}. */
    public static final String PATH = "/api/internal/ingestion/**";

    private static final String GOOGLE_ISSUER = "https://accounts.google.com";

    /** Checks signature (Google's published certificates, cached), expiry, issuer and audience. */
    @Bean
    TokenVerifier ingestionTriggerTokenVerifier(final IngestionProperties properties) {
        return TokenVerifier.newBuilder()
                .setAudience(properties.triggerAudience())
                .setIssuer(GOOGLE_ISSUER)
                .build();
    }

    @Bean
    @Order(-2)
    SecurityFilterChain ingestionWorkerSecurity(
            final HttpSecurity http,
            final IngestionProperties properties,
            final TokenVerifier ingestionTriggerTokenVerifier)
            throws Exception {
        http.securityMatcher(PATH)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.ignoringRequestMatchers(PATH))
                .authorizeHttpRequests(requests -> requests.anyRequest().hasRole("INGESTION_WORKER"))
                .exceptionHandling(handling -> handling.authenticationEntryPoint((request, response, failure) -> {
                    response.setStatus(401);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"detail\":\"Ingestion trigger authentication required\"}");
                }))
                .addFilterBefore(
                        new SchedulerTokenFilter(properties, ingestionTriggerTokenVerifier),
                        AnonymousAuthenticationFilter.class);
        return http.build();
    }

    /** Accepts {@code Authorization: Bearer <Google ID token>} of the configured service account only. */
    private static final class SchedulerTokenFilter extends OncePerRequestFilter {

        private static final String PREFIX = "Bearer ";

        private final IngestionProperties properties;
        private final TokenVerifier verifier;

        private SchedulerTokenFilter(final IngestionProperties properties, final TokenVerifier verifier) {
            this.properties = properties;
            this.verifier = verifier;
        }

        @Override
        protected void doFilterInternal(
                final HttpServletRequest request, final HttpServletResponse response, final FilterChain chain)
                throws ServletException, IOException {
            if (authorized(request.getHeader("Authorization"))) {
                final var context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(
                        properties.triggerServiceAccount(),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_INGESTION_WORKER"))));
                SecurityContextHolder.setContext(context);
            }
            chain.doFilter(request, response);
        }

        private boolean authorized(final String header) {
            final var account = properties.triggerServiceAccount();
            if (!properties.enabled()
                    || account == null
                    || account.isBlank()
                    || properties.triggerAudience() == null
                    || properties.triggerAudience().isBlank()
                    || header == null
                    || !header.startsWith(PREFIX)) {
                return false;
            }
            try {
                final var payload =
                        verifier.verify(header.substring(PREFIX.length())).getPayload();
                return account.equals(payload.get("email")) && Boolean.TRUE.equals(payload.get("email_verified"));
            } catch (TokenVerifier.VerificationException rejected) {
                return false;
            }
        }
    }
}
