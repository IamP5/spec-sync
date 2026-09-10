package com.fiap.ford.specsync.web.controllers;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fiap.ford.specsync.application.ontology.*;
import com.fiap.ford.specsync.domain.ontology.Ontology;
import com.fiap.ford.specsync.infrastructure.configuration.*;
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

@WebMvcTest(OntologyController.class)
@Import({SecurityConfiguration.class, IngestionConfiguration.class, GlobalExceptionHandler.class})
@TestPropertySource(
        properties = {
            "specsync.ingestion.enabled=true",
            "specsync.ingestion.reviewer-key=" + OntologyControllerWebMvcTest.KEY
        })
class OntologyControllerWebMvcTest {
    static final String KEY = "test-ontology-curator-key-0123456789abcdefghijklmn";
    static final String BASE = "/api/ontology/proposals";
    static final UUID ID = UUID.fromString("e6350100-155a-4e48-b346-eed1ee1b99b0");

    @Autowired
    MockMvc mvc;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    ListOntology list;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    ActivateOntology activate;

    @Test
    void requiresTheCuratorKeyForEveryOntologySurface() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
        mvc.perform(post(BASE + "/" + ID + "/activate")).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE).header("Authorization", "Bearer " + KEY)).andExpect(status().isUnauthorized());
        verifyNoInteractions(list, activate);
    }

    @Test
    void usesTheAuthenticatedCuratorAndExactRevision() throws Exception {
        when(activate.execute(any(ActivateOntology.Input.class)))
                .thenReturn(() -> new Ontology.Overview(2, 1, null, List.of()));
        mvc.perform(post(BASE + "/" + ID + "/activate")
                        .header("X-Ingestion-Key", KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"baseRevision\":1,\"reason\":\"Reviewed distinct source meaning\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision").value(2))
                .andExpect(jsonPath("$.projectedRevision").value(1));
        verify(activate)
                .execute(new ActivateOntology.Input(
                        ID, "curator", new Ontology.Decision(1, "Reviewed distinct source meaning")));
    }

    @Test
    void rejectsMissingReviewReasonBeforeCallingTheUseCase() throws Exception {
        mvc.perform(post(BASE + "/" + ID + "/activate")
                        .header("X-Ingestion-Key", KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"baseRevision\":1,\"reason\":\"\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(activate);
    }
}
