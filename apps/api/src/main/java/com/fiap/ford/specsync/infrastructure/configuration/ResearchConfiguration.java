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

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ResearchProperties.class)
public class ResearchConfiguration {

    /** Base path of the internal research API; everything below it needs {@code ROLE_AI_RESEARCH}. */
    public static final String PATH = "/api/internal/research/**";

    @Bean
    @Order(-1)
    SecurityFilterChain aiResearchSecurity(final HttpSecurity http, final ResearchProperties properties)
            throws Exception {
        http.securityMatcher(PATH)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.ignoringRequestMatchers(PATH))
                .authorizeHttpRequests(requests -> requests.anyRequest().hasRole("AI_RESEARCH"))
                .exceptionHandling(handling -> handling.authenticationEntryPoint((request, response, failure) -> {
                    response.setStatus(401);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"detail\":\"Research service authentication required\"}");
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

        private final ResearchProperties properties;

        private ServiceKeyFilter(final ResearchProperties properties) {
            this.properties = properties;
        }

        @Override
        protected void doFilterInternal(
                final HttpServletRequest request, final HttpServletResponse response, final FilterChain chain)
                throws ServletException, IOException {
            if (properties.enabled() && matches(request.getHeader("Authorization"))) {
                final var context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(
                        "ai-research", null, List.of(new SimpleGrantedAuthority("ROLE_AI_RESEARCH"))));
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
