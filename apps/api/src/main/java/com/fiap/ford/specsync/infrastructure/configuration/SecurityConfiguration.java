package com.fiap.ford.specsync.infrastructure.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration(proxyBeanMethods = false)
public class SecurityConfiguration {

    @Bean
    SecurityFilterChain securityFilterChain(final HttpSecurity http) throws Exception {
        // This POST only searches an index; it cannot mutate catalog or review content.
        http.csrf(csrf -> csrf.ignoringRequestMatchers("/api/knowledge/reviews"));
        http.authorizeHttpRequests(authorize -> authorize
                .requestMatchers(
                        org.springframework.http.HttpMethod.GET,
                        "/api/greeting",
                        "/api/vehicle-configurations",
                        "/api/comparison-attributes",
                        "/api/comparisons",
                        "/api/knowledge/**",
                        "/api/vehicle-specifications")
                .permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/knowledge/reviews")
                .permitAll()
                .anyRequest()
                .authenticated());

        return http.build();
    }
}
