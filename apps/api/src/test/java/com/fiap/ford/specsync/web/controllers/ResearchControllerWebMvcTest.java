package com.fiap.ford.specsync.web.controllers;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fiap.ford.specsync.application.research.*;
import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import com.fiap.ford.specsync.domain.research.Research;
import com.fiap.ford.specsync.infrastructure.configuration.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({ResearchController.class, ResearchAttemptController.class})
@Import({SecurityConfiguration.class, ResearchConfiguration.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = "specsync.research.service-key=" + ResearchControllerWebMvcTest.KEY)
class ResearchControllerWebMvcTest {
    static final String KEY = "test-research-service-key-0123456789abcdefghijklmn";
    static final UUID ID = UUID.fromString("e6350100-155a-4e48-b346-eed1ee1b99b0");
    static final UUID WORK = UUID.fromString("7383d3fc-5e30-4d37-89c9-528b278368de");
    static final UUID ATTEMPT = UUID.fromString("6d8ccfe4-f819-4c11-bef5-7d70f86603a4");
    static final String BASE = "/api/internal/research/users/user-a/requests";
    static final String ATTEMPT_BASE = "/api/internal/research/works/" + WORK + "/attempts/" + ATTEMPT;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    ListResearchInterests interests;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    SaveResearchInterest saveInterest;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    ResolveResearchReview resolveReview;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    com.fiap.ford.specsync.application.ingestion.GetIngestion review;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    com.fiap.ford.specsync.application.ingestion.PublishIngestion publish;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    com.fiap.ford.specsync.application.ingestion.GetIngestionSource reviewSource;

    @Autowired
    MockMvc mvc;

    @MockitoBean(answers = org.mockito.Answers.CALLS_REAL_METHODS)
    com.fiap.ford.specsync.application.research.ReplayResearch replay;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    CreateResearch create;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    GetResearch get;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    ListResearch list;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    CancelResearch cancel;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    HeartbeatResearch heartbeat;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    ListResearchCheckpoints checkpoints;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    SaveResearchCheckpoint checkpoint;

    @Test
    void rejectsEveryPrivateSurfaceWithoutTheServiceKey() throws Exception {
        mvc.perform(get(BASE + "/" + ID + "/review")).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE + "/" + ID + "/review/source")).andExpect(status().isUnauthorized());
        mvc.perform(post(BASE + "/" + ID + "/review/publish")).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
        mvc.perform(post(BASE)).andExpect(status().isUnauthorized());
        mvc.perform(delete(BASE + "/" + ID)).andExpect(status().isUnauthorized());
        mvc.perform(post(BASE + "/" + ID + "/replay")).andExpect(status().isUnauthorized());
        mvc.perform(get(ATTEMPT_BASE + "/checkpoints")).andExpect(status().isUnauthorized());
        mvc.perform(post(ATTEMPT_BASE + "/heartbeat")).andExpect(status().isUnauthorized());
        mvc.perform(put(ATTEMPT_BASE + "/checkpoints/capture-source")).andExpect(status().isUnauthorized());
        verifyNoInteractions(create, get, list, cancel, heartbeat, checkpoints, checkpoint);
    }

    @Test
    void rejectsWrongKeyAndReviewerHeader() throws Exception {
        mvc.perform(get(BASE).header("Authorization", "Bearer " + KEY + "x")).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE).header("X-Ingestion-Key", KEY)).andExpect(status().isUnauthorized());
        verifyNoInteractions(list);
    }

    @Test
    void createsWithTheTrustedPathIdentityAndReturnsAFlatSafeSnapshot() throws Exception {
        when(create.execute(any(CreateResearch.Input.class))).thenReturn(() -> snapshot());
        mvc.perform(post(BASE)
                        .header("Authorization", "Bearer " + KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                    {"id":"e6350100-155a-4e48-b346-eed1ee1b99b0","request":{"sourceUrl":"https://example.com/source.pdf","brand":"Ford","model":"Ranger","market":"BR","modelYear":2026,"configurations":["Limited"]}}
                    """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ID.toString()))
                .andExpect(jsonPath("$.workId").value(WORK.toString()))
                .andExpect(jsonPath("$.request.configurations[0]").value("Limited"))
                .andExpect(jsonPath("$.source.originalSha256").value("source-hash"))
                .andExpect(jsonPath("$.source.text").doesNotExist())
                .andExpect(jsonPath("$.source.originalBase64").doesNotExist())
                .andExpect(jsonPath("$.uid").doesNotExist())
                .andExpect(jsonPath("$.leaseToken").doesNotExist())
                .andExpect(jsonPath("$.subscribers").doesNotExist())
                .andExpect(jsonPath("$.draftHash").doesNotExist());
        verify(create).execute(new CreateResearch.Input(ID, "user-a", snapshot().request()));
    }

    @Test
    void listsOnlyTheTrustedUsersRequests() throws Exception {
        when(list.execute(any(ListResearch.Input.class))).thenReturn(() -> List.of(summary()));
        mvc.perform(get(BASE).header("Authorization", "Bearer " + KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requests[0].id").value(ID.toString()))
                .andExpect(jsonPath("$.requests[0].stage").value("review"))
                .andExpect(jsonPath("$.requests[0].configurations").doesNotExist())
                .andExpect(jsonPath("$.requests[0].source").doesNotExist())
                .andExpect(jsonPath("$.requests[0].warnings").doesNotExist());
        verify(list).execute(new ListResearch.Input("user-a"));
    }

    @Test
    void replayUsesTheTrustedUserAndNewPrivateRequestIdentity() throws Exception {
        when(replay.execute(any(ReplayResearch.Input.class))).thenReturn(() -> snapshot());
        mvc.perform(post(BASE + "/" + ID + "/replay")
                        .header("Authorization", "Bearer " + KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"" + WORK + "\"}"))
                .andExpect(status().isOk());
        verify(replay).execute(new ReplayResearch.Input(ID, "user-a", WORK));
    }

    @Test
    void cancellationUsesPrivateRequestIdentity() throws Exception {
        when(cancel.execute(any(CancelResearch.Input.class))).thenReturn(() -> snapshot());
        mvc.perform(delete(BASE + "/" + ID).header("Authorization", "Bearer " + KEY))
                .andExpect(status().isOk());
        verify(cancel).execute(new CancelResearch.Input(ID, "user-a"));
    }

    @Test
    void passesAttemptIdentityToHeartbeatAndOpaqueCheckpoint() throws Exception {
        mvc.perform(post(ATTEMPT_BASE + "/heartbeat").header("Authorization", "Bearer " + KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true));
        mvc.perform(put(ATTEMPT_BASE + "/checkpoints/capture-source")
                        .header("Authorization", "Bearer " + KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"payload\":\"{}\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true));
        verify(heartbeat).execute(new HeartbeatResearch.Input(WORK, ATTEMPT));
        verify(checkpoint)
                .execute(new SaveResearchCheckpoint.Input(
                        WORK, ATTEMPT, new Research.Checkpoint("capture-source", "{}")));
    }

    @Test
    void rejectsAnUnsafeCheckpointKeyBeforeCallingTheUseCase() throws Exception {
        mvc.perform(put(ATTEMPT_BASE + "/checkpoints/Capture_Source")
                        .header("Authorization", "Bearer " + KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"payload\":\"{}\"}"))
                .andExpect(status().isUnprocessableEntity());
        verifyNoInteractions(checkpoint);
    }

    @Test
    void rejectsMissingRequestIdentityBeforeCallingTheUseCase() throws Exception {
        mvc.perform(post(BASE)
                        .header("Authorization", "Bearer " + KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(create);
    }

    private static Research.Summary summary() {
        var value = snapshot();
        return new Research.Summary(
                value.id(),
                value.workId(),
                value.requestStatus(),
                value.disposition(),
                value.request(),
                value.status(),
                value.attempts(),
                value.stage(),
                value.createdAt(),
                value.updatedAt());
    }

    private static Research.Snapshot snapshot() {
        return new Research.Snapshot(
                ID,
                WORK,
                "ACTIVE",
                "JOINED",
                new Ingestion.Request(
                        "https://example.com/source.pdf", "Ford", "Ranger", "BR", 2026, List.of("Limited")),
                "REVIEW",
                1,
                "review",
                List.of(),
                List.of("Draft needs review"),
                null,
                new Research.Source(
                        "https://example.com/source.pdf",
                        "Ford brochure",
                        "application/pdf",
                        "source-hash",
                        "text-hash",
                        "parser-v1"),
                Map.of(),
                Instant.parse("2026-09-08T00:00:00Z"),
                Instant.parse("2026-09-08T00:00:10Z"));
    }
}
