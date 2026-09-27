package com.fiap.ford.specsync.infrastructure.configuration;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.security.autoconfigure.web.servlet.SecurityFilterProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registers the audit and rate-limit filters ahead of Spring Security: audit outermost (it must
 * observe 429s and every chain's 401/403), rate limiting next (so failed key guesses count too).
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(RateLimitProperties.class)
public class ApiHardeningConfiguration {

    @Bean
    FilterRegistrationBean<SecurityAuditFilter> securityAuditFilter() {
        final var registration = new FilterRegistrationBean<>(new SecurityAuditFilter());
        registration.setOrder(SecurityFilterProperties.DEFAULT_FILTER_ORDER - 2);
        return registration;
    }

    @Bean
    FilterRegistrationBean<RateLimitFilter> rateLimitFilter(final RateLimitProperties properties) {
        final var registration = new FilterRegistrationBean<>(
                new RateLimitFilter(properties.requestsPerMinute(), System::currentTimeMillis));
        registration.setOrder(SecurityFilterProperties.DEFAULT_FILTER_ORDER - 1);
        registration.setEnabled(properties.enabled());
        return registration;
    }
}
