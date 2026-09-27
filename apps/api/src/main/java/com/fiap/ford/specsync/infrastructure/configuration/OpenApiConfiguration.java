package com.fiap.ford.specsync.infrastructure.configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI document ({@code /v3/api-docs}, Swagger UI at {@code /swagger-ui.html}). The security
 * schemes named here are referenced by {@code @SecurityRequirement} on the {@code *Api} interfaces.
 */
@Configuration(proxyBeanMethods = false)
public class OpenApiConfiguration {

    /** User requests: the Identity Platform ID token the gateway verified and forwarded. */
    public static final String USER_TOKEN = "userToken";

    /** Internal calls from the AI service: a shared service key per surface. */
    public static final String SERVICE_KEY = "serviceKey";

    /** Cloud Scheduler: a Google-signed OIDC token of its service account. */
    public static final String SCHEDULER_TOKEN = "schedulerToken";

    @Bean
    OpenAPI specSyncOpenApi() {
        return new OpenAPI()
                .info(new Info().title("SpecSync API").version("v1").description("""
                                Vehicle catalog, comparison, ingestion review and AI credits of SpecSync.

                                Authentication happens in the gateway: the browser signs in with Google \
                                (Identity Platform) and the gateway forwards the verified ID token as \
                                `Authorization: Bearer <JWT>`. This API validates the JWT (signature, \
                                issuer, audience, expiry) and authorises by its `roles` claim: \
                                `USER` (any valid token) < `CURATOR` < `ADMIN`. Catalog reads are public.

                                Every error is an RFC 9457 problem (`application/problem+json`)."""))
                .components(new Components()
                        .addSecuritySchemes(
                                USER_TOKEN,
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Identity Platform ID token forwarded by the gateway"))
                        .addSecuritySchemes(
                                SERVICE_KEY,
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .description("Internal service key (AI service only)"))
                        .addSecuritySchemes(
                                SCHEDULER_TOKEN,
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Google OIDC token of the Cloud Scheduler service account")));
    }
}
