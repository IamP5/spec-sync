package com.fiap.ford.specsync.web.controllers;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fiap.ford.specsync.application.ingestion.DrainIngestion;
import com.fiap.ford.specsync.infrastructure.configuration.*;
import com.google.api.client.json.webtoken.JsonWebSignature;
import com.google.api.client.json.webtoken.JsonWebToken;
import com.google.auth.oauth2.TokenVerifier;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(IngestionWorkerController.class)
@Import({SecurityConfiguration.class, IngestionWorkerConfiguration.class, GlobalExceptionHandler.class})
@TestPropertySource(
        properties = {
            "specsync.ingestion.enabled=true",
            "specsync.ingestion.trigger-service-account=" + IngestionWorkerControllerWebMvcTest.SCHEDULER,
            "specsync.ingestion.trigger-audience=https://specsync-api.example.run.app"
        })
class IngestionWorkerControllerWebMvcTest {
    static final String SCHEDULER = "specsync-dev-ingestion-trigger@project.iam.gserviceaccount.com";
    static final String DRAIN = "/api/internal/ingestion/drain";

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    DrainIngestion drain;

    @MockitoBean
    TokenVerifier verifier;

    @Autowired
    MockMvc mvc;

    @Test
    void drainsTheQueueForTheSchedulerServiceAccount() throws Exception {
        when(verifier.verify("scheduler-token")).thenReturn(token(SCHEDULER, true));
        doReturn((DrainIngestion.Output) () -> 2).when(drain).execute(any(DrainIngestion.Input.class));
        mvc.perform(post(DRAIN).header("Authorization", "Bearer scheduler-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cycles").value(2));
        verify(drain).execute(new DrainIngestion.Input(IngestionWorkerController.BUDGET));
    }

    @Test
    void rejectsAnotherServiceAccount() throws Exception {
        when(verifier.verify("gateway-token"))
                .thenReturn(token("specsync-dev-gateway@project.iam.gserviceaccount.com", true));
        mvc.perform(post(DRAIN).header("Authorization", "Bearer gateway-token")).andExpect(status().isUnauthorized());
        verify(drain, never()).execute(any(DrainIngestion.Input.class));
    }

    @Test
    void rejectsAnUnverifiedEmail() throws Exception {
        when(verifier.verify("unverified-token")).thenReturn(token(SCHEDULER, false));
        mvc.perform(post(DRAIN).header("Authorization", "Bearer unverified-token"))
                .andExpect(status().isUnauthorized());
        verify(drain, never()).execute(any(DrainIngestion.Input.class));
    }

    @Test
    void rejectsATokenThatFailsVerification() throws Exception {
        when(verifier.verify("forged-token")).thenThrow(new TokenVerifier.VerificationException("bad signature"));
        mvc.perform(post(DRAIN).header("Authorization", "Bearer forged-token")).andExpect(status().isUnauthorized());
        verify(drain, never()).execute(any(DrainIngestion.Input.class));
    }

    @Test
    void rejectsARequestWithoutAToken() throws Exception {
        mvc.perform(post(DRAIN)).andExpect(status().isUnauthorized());
        verifyNoInteractions(verifier);
        verify(drain, never()).execute(any(DrainIngestion.Input.class));
    }

    private static JsonWebSignature token(String email, boolean verified) {
        var payload = new JsonWebToken.Payload();
        payload.set("email", email);
        payload.set("email_verified", verified);
        return new JsonWebSignature(new JsonWebSignature.Header(), payload, new byte[0], new byte[0]);
    }
}
