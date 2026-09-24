package com.fiap.ford.specsync.web.controllers;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** RBAC of the curation surface once the API verifies the user's own Firebase token. */
@WebMvcTest(OntologyController.class)
@Import({SecurityConfiguration.class, IngestionConfiguration.class, GlobalExceptionHandler.class})
@TestPropertySource(
        properties = {
            "specsync.ingestion.enabled=true",
            "specsync.ingestion.reviewer-key=" + OntologyControllerRbacWebMvcTest.KEY,
            "specsync.security.jwt.project-id=specsync-test"
        })
class OntologyControllerRbacWebMvcTest {
    static final String KEY = "test-ontology-curator-key-0123456789abcdefghijklmn";
    static final String BASE = "/api/ontology/proposals";
    static final UUID ID = UUID.fromString("e6350100-155a-4e48-b346-eed1ee1b99b0");
    static final String DECISION = "{\"baseRevision\":1,\"reason\":\"Reviewed distinct source meaning\"}";

    @Autowired
    MockMvc mvc;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    ListOntology list;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    ActivateOntology activate;

    @Test
    void rejectsTheSharedCuratorKeyAndMalformedTokens() throws Exception {
        mvc.perform(get(BASE).header("X-Ingestion-Key", KEY)).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE).header("X-SpecSync-Token", "not-a-jwt")).andExpect(status().isUnauthorized());
        verifyNoInteractions(list, activate);
    }

    @Test
    void analystsCannotReachTheCurationSurface() throws Exception {
        mvc.perform(get(BASE).with(user("ROLE_ANALYST"))).andExpect(status().isForbidden());
        verifyNoInteractions(list);
    }

    @Test
    void reviewersReadProposalsButCannotActivateThem() throws Exception {
        when(list.execute()).thenReturn(() -> new Ontology.Overview(1, 1, null, List.of()));
        mvc.perform(get(BASE).with(user("ROLE_REVIEWER"))).andExpect(status().isOk());
        mvc.perform(post(BASE + "/" + ID + "/activate")
                        .with(user("ROLE_REVIEWER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(DECISION))
                .andExpect(status().isForbidden());
        verifyNoInteractions(activate);
    }

    @Test
    void administratorsActivateAndAreRecordedByTheirOwnUid() throws Exception {
        when(activate.execute(any(ActivateOntology.Input.class)))
                .thenReturn(() -> new Ontology.Overview(2, 1, null, List.of()));
        mvc.perform(post(BASE + "/" + ID + "/activate")
                        .with(user("ROLE_ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(DECISION))
                .andExpect(status().isOk());
        verify(activate)
                .execute(new ActivateOntology.Input(
                        ID, "uid-admin", new Ontology.Decision(1, "Reviewed distinct source meaning")));
    }

    private static RequestPostProcessor user(final String role) {
        return jwt().jwt(token -> token.subject(role.equals("ROLE_ADMIN") ? "uid-admin" : "uid-user"))
                .authorities(new SimpleGrantedAuthority(role));
    }
}
