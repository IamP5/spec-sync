package com.fiap.ford.specsync.web.controllers;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fiap.ford.specsync.application.access.impl.DefaultGetCurrentCaller;
import com.fiap.ford.specsync.application.catalog.CompareVehicles;
import com.fiap.ford.specsync.application.catalog.ListComparisonAttributes;
import com.fiap.ford.specsync.application.catalog.SearchVehicleConfigurations;
import com.fiap.ford.specsync.application.ingestion.CreateIngestion;
import com.fiap.ford.specsync.application.ingestion.GetIngestion;
import com.fiap.ford.specsync.application.ingestion.GetIngestionSource;
import com.fiap.ford.specsync.application.ingestion.ListIngestions;
import com.fiap.ford.specsync.application.ingestion.PublishIngestion;
import com.fiap.ford.specsync.application.ingestion.RejectIngestion;
import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import com.fiap.ford.specsync.infrastructure.configuration.GlobalExceptionHandler;
import com.fiap.ford.specsync.infrastructure.configuration.IngestionConfiguration;
import com.fiap.ford.specsync.infrastructure.configuration.SecurityConfiguration;
import com.fiap.ford.specsync.testing.TestTokens;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * End-to-end authorisation of the HTTP surface with real signed tokens: public, authenticated and
 * role-protected endpoints; expired, forged and foreign tokens; and the RFC 9457 bodies of 401/403.
 * Use cases are mocked; security, JWT validation and error mapping are the production beans.
 */
@WebMvcTest({CallerController.class, CatalogController.class, IngestionController.class})
@Import({
    SecurityConfiguration.class,
    IngestionConfiguration.class,
    GlobalExceptionHandler.class,
    DefaultGetCurrentCaller.class,
    TestTokens.Keys.class
})
@TestPropertySource(properties = "specsync.ingestion.enabled=true")
class AuthorizationWebMvcTest {

    static final UUID RUN = UUID.fromString("0f6f5c1e-8a51-4c43-9d0e-3ad1d5b3d0a1");

    @Autowired
    MockMvc mvc;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    SearchVehicleConfigurations search;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    ListComparisonAttributes attributes;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    CompareVehicles compare;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    CreateIngestion create;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    GetIngestion getIngestion;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    ListIngestions list;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    PublishIngestion publish;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    RejectIngestion reject;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    GetIngestionSource source;

    static String bearer(final String token) {
        return "Bearer " + token;
    }

    @Nested
    class PublicEndpoints {

        @Test
        void catalogReadsNeedNoToken() throws Exception {
            when(attributes.execute(any(ListComparisonAttributes.Input.class))).thenReturn(List::of);

            mvc.perform(get("/api/comparison-attributes")).andExpect(status().isOk());
        }

        @Test
        void apiDocumentationNeedsNoToken() throws Exception {
            // springdoc is not part of the MVC slice; reaching the dispatcher (404) proves the
            // chain let the anonymous request through instead of answering 401.
            mvc.perform(get("/v3/api-docs")).andExpect(status().isNotFound());
        }
    }

    @Nested
    class Authentication {

        @Test
        void answersProblem401WithBearerChallengeWithoutToken() throws Exception {
            mvc.perform(get("/api/me"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(header().string("WWW-Authenticate", containsString("Bearer")))
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.status").value(401))
                    .andExpect(jsonPath("$.title").value("Unauthorized"))
                    .andExpect(jsonPath("$.detail").value("A valid bearer token is required"))
                    .andExpect(jsonPath("$.instance").value("/api/me"))
                    // Same fields as the problems Spring MVC renders: no explicit about:blank type.
                    .andExpect(jsonPath("$.type").doesNotExist());
        }

        @Test
        void describesTheCallerFromAValidToken() throws Exception {
            mvc.perform(get("/api/me").header("Authorization", bearer(TestTokens.user("uid-7"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.uid").value("uid-7"))
                    .andExpect(jsonPath("$.email").value("uid-7@example.com"))
                    .andExpect(jsonPath("$.roles[0]").value("USER"))
                    .andExpect(jsonPath("$.expiresAt").exists());
        }

        @Test
        void listsEveryEffectiveRoleMostPrivilegedFirst() throws Exception {
            mvc.perform(get("/api/me").header("Authorization", bearer(TestTokens.user("uid-7", "admin"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.roles[0]").value("ADMIN"))
                    .andExpect(jsonPath("$.roles[1]").value("USER"));
        }

        @Test
        void rejectsAnExpiredTokenAsInvalid() throws Exception {
            final var expired = TestTokens.builder("uid-7").expired().sign();

            mvc.perform(get("/api/me").header("Authorization", bearer(expired)))
                    .andExpect(status().isUnauthorized())
                    .andExpect(header().string("WWW-Authenticate", containsString("invalid_token")))
                    .andExpect(jsonPath("$.reason", containsString("expired")));
        }

        @Test
        void rejectsAForgedToken() throws Exception {
            final var forged =
                    TestTokens.builder("uid-7").roles("admin").foreignKey().sign();

            mvc.perform(get("/api/ingestions").header("Authorization", bearer(forged)))
                    .andExpect(status().isUnauthorized());
            verifyNoInteractions(list);
        }

        @Test
        void rejectsATokenOfAnotherProject() throws Exception {
            final var foreign =
                    TestTokens.builder("uid-7").audience("other-project").sign();

            mvc.perform(get("/api/me").header("Authorization", bearer(foreign))).andExpect(status().isUnauthorized());
        }

        @Test
        void rejectsAMalformedToken() throws Exception {
            mvc.perform(get("/api/me").header("Authorization", "Bearer not-a-jwt"))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    class CuratorRole {

        @Test
        void refusesAUserWithoutTheCuratorRole() throws Exception {
            mvc.perform(get("/api/ingestions").header("Authorization", bearer(TestTokens.user("uid-7"))))
                    .andExpect(status().isForbidden())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.detail").value("The curator role is required"));
            verifyNoInteractions(list);
        }

        @Test
        void refusesTheRetiredSharedCuratorKey() throws Exception {
            mvc.perform(get("/api/ingestions").header("X-Ingestion-Key", "x".repeat(48)))
                    .andExpect(status().isUnauthorized());
            verifyNoInteractions(list);
        }

        @Test
        void letsACuratorListTheSharedQueue() throws Exception {
            when(list.execute(any(ListIngestions.Input.class))).thenReturn(List::of);

            mvc.perform(get("/api/ingestions").header("Authorization", bearer(TestTokens.user("uid-7", "curator"))))
                    .andExpect(status().isOk());
            verify(list).execute(new ListIngestions.Input(Ingestion.CURATOR_WORKSPACE));
        }

        @Test
        void letsAnAdminDoWhatACuratorMay() throws Exception {
            when(list.execute(any(ListIngestions.Input.class))).thenReturn(List::of);

            mvc.perform(get("/api/ingestions").header("Authorization", bearer(TestTokens.user("uid-1", "admin"))))
                    .andExpect(status().isOk());
        }

        @Test
        void createsAnImportWith201AndItsLocation() throws Exception {
            when(create.execute(any(CreateIngestion.Input.class))).thenReturn(() -> run(RUN));

            mvc.perform(post("/api/ingestions")
                            .header("Authorization", bearer(TestTokens.user("uid-7", "curator")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"id":"%s","request":{"sourceUrl":"https://www.ford.com.br/ranger",
                                    "brand":"Ford","model":"Ranger","market":"BR","modelYear":2026,
                                    "configurations":["XLS"]}}""".formatted(RUN)))
                    .andExpect(status().isCreated())
                    .andExpect(header().string("Location", endsWith("/api/ingestions/" + RUN)))
                    .andExpect(jsonPath("$.result.id").value(RUN.toString()));
        }

        @Test
        void rejectsAnIncompleteBodyWith400AndTheFailedProperties() throws Exception {
            mvc.perform(post("/api/ingestions")
                            .header("Authorization", bearer(TestTokens.user("uid-7", "curator")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.errors[*].property", org.hamcrest.Matchers.hasItems("id", "request")));
            verifyNoInteractions(create);
        }

        @Test
        void mapsABusinessRuleViolationTo422() throws Exception {
            when(getIngestion.execute(any(GetIngestion.Input.class)))
                    .thenThrow(DomainException.notFound(Ingestion.class, RUN));

            mvc.perform(get("/api/ingestions/" + RUN)
                            .header("Authorization", bearer(TestTokens.user("uid-7", "curator"))))
                    .andExpect(status().isUnprocessableContent())
                    .andExpect(jsonPath("$.errors[0].property").value("id"));
        }

        @Test
        void answers405ForAnUnsupportedMethod() throws Exception {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                                    "/api/ingestions/" + RUN)
                            .header("Authorization", bearer(TestTokens.user("uid-7", "curator"))))
                    .andExpect(status().isMethodNotAllowed())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        }
    }

    static Ingestion.Run run(final UUID id) {
        return new Ingestion.Run(
                id,
                new Ingestion.Request("https://www.ford.com.br/ranger", "Ford", "Ranger", "BR", 2026, List.of("XLS")),
                "QUEUED",
                0,
                null,
                null,
                0,
                java.util.Map.of(),
                null,
                null,
                null,
                java.util.Map.of(),
                java.time.Instant.parse("2026-09-27T12:00:00Z"),
                java.time.Instant.parse("2026-09-27T12:00:00Z"),
                List.of());
    }
}
