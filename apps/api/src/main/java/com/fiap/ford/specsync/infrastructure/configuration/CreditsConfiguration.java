package com.fiap.ford.specsync.infrastructure.configuration;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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
 * Security of the internal wallet endpoints. The AI service is the only caller: it verifies the
 * user's Firebase token and then presents the shared service key, so this API trusts the {@code uid}
 * in the path only after the key matched. In the cloud, Cloud Run's invoker identity is a second,
 * independent gate.
 *
 * <p>The chain is ordered ahead of the ingestion chain ({@code @Order(1)}) so both stay distinct and
 * deterministic; their {@code securityMatcher}s do not overlap.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(CreditsProperties.class)
public class CreditsConfiguration {

    /** Base path of the internal wallet API; everything below it needs {@code ROLE_AI_CREDITS}. */
    public static final String PATH = "/api/internal/ai-credits/**";

    @Bean
    @Order(0)
    SecurityFilterChain aiCreditsSecurity(final HttpSecurity http, final CreditsProperties properties)
            throws Exception {
        http.securityMatcher(PATH)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.ignoringRequestMatchers(PATH))
                .authorizeHttpRequests(requests -> requests.anyRequest().hasRole("AI_CREDITS"))
                .exceptionHandling(handling -> handling.authenticationEntryPoint((request, response, failure) -> {
                    response.setStatus(401);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"detail\":\"Credits service authentication required\"}");
                }))
                .addFilterBefore(new ServiceKeyFilter(properties), AnonymousAuthenticationFilter.class);
        return http.build();
    }

    /**
     * Authenticates {@code Authorization: Bearer <key>} against the configured service key. The
     * comparison is constant time and both operands are fixed-length digests, so neither the key's
     * length nor its content leaks through timing.
     */
    private static final class ServiceKeyFilter extends OncePerRequestFilter {

        private static final String PREFIX = "Bearer ";

        private final CreditsProperties properties;

        private ServiceKeyFilter(final CreditsProperties properties) {
            this.properties = properties;
        }

        @Override
        protected void doFilterInternal(
                final HttpServletRequest request, final HttpServletResponse response, final FilterChain chain)
                throws ServletException, IOException {
            if (properties.enabled() && matches(request.getHeader("Authorization"))) {
                final var context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(
                        "ai-credits", null, List.of(new SimpleGrantedAuthority("ROLE_AI_CREDITS"))));
                SecurityContextHolder.setContext(context);
            }
            chain.doFilter(request, response);
        }

        private boolean matches(final String header) {
            if (header == null || !header.startsWith(PREFIX)) {
                return false;
            }
            return MessageDigest.isEqual(digest(properties.serviceKey()), digest(header.substring(PREFIX.length())));
        }

        private static byte[] digest(final String value) {
            try {
                return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            } catch (java.security.NoSuchAlgorithmException impossible) {
                throw new IllegalStateException(impossible);
            }
        }
    }
}
