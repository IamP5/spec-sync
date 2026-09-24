package com.fiap.ford.specsync.web.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fiap.ford.specsync.application.catalog.*;
import com.fiap.ford.specsync.domain.catalog.Catalog;
import com.fiap.ford.specsync.infrastructure.configuration.*;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CatalogController.class)
@Import({
    SecurityConfiguration.class,
    IngestionConfiguration.class,
    ApiHardeningConfiguration.class,
    GlobalExceptionHandler.class
})
@TestPropertySource(
        properties = {
            "specsync.rate-limit.requests-per-minute=2",
            "specsync.ingestion.enabled=true",
            "specsync.ingestion.reviewer-key=test-hardening-curator-key-0123456789abcdefghij",
            "logging.structured.format.console=logstash",
            "logging.structured.json.rename.level=severity"
        })
@ExtendWith(OutputCaptureExtension.class)
class ApiHardeningWebMvcTest {
    private static final String SEARCH = "/api/vehicle-configurations";

    @Autowired
    MockMvc mvc;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    SearchVehicleConfigurations search;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    ListComparisonAttributes attributes;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    CompareVehicles compare;

    @Test
    void throttlesEachCallerSeparatelyAndLogsTheRejection(final CapturedOutput output) throws Exception {
        when(search.execute(any(SearchVehicleConfigurations.Input.class)))
                .thenReturn(() -> new Catalog.Page(List.of(), 20, 0, false));
        final var alice = user("alice");

        mvc.perform(get(SEARCH).header("X-SpecSync-User", alice)).andExpect(status().isOk());
        mvc.perform(get(SEARCH).header("X-SpecSync-User", alice)).andExpect(status().isOk());
        mvc.perform(get(SEARCH).header("X-SpecSync-User", alice))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(content().contentType("application/problem+json"))
                .andExpect(jsonPath("$.status").value(429));
        mvc.perform(get(SEARCH).header("X-SpecSync-User", user("bob"))).andExpect(status().isOk());

        verify(search, times(3)).execute(any(SearchVehicleConfigurations.Input.class));
        assertThat(output).contains("\"event\":\"security.rate_limited\"").contains("\"caller\":\"user:alice\"");
    }

    @Test
    void auditsAuthenticationFailuresWithoutLeakingCredentials(final CapturedOutput output) throws Exception {
        mvc.perform(get("/api/ingestions").header("X-Ingestion-Key", "guessed-key-never-logged"))
                .andExpect(status().isUnauthorized());

        assertThat(output)
                .contains("\"event\":\"security.authentication_failed\"")
                .contains("\"severity\":\"WARN\"")
                .doesNotContain("guessed-key-never-logged");
    }

    private static String user(final String uid) {
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(("{\"uid\":\"" + uid + "\",\"roles\":[]}").getBytes(StandardCharsets.UTF_8));
    }
}
