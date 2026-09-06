package com.fiap.ford.specsync.web.controllers;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fiap.ford.specsync.application.knowledge.RetrieveKnowledge;
import com.fiap.ford.specsync.domain.knowledge.KnowledgeResult;
import com.fiap.ford.specsync.infrastructure.configuration.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(KnowledgeController.class)
@Import({SecurityConfiguration.class, GlobalExceptionHandler.class})
class KnowledgeControllerWebMvcTest {
    @Autowired
    MockMvc mvc;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    RetrieveKnowledge useCase;

    @Test
    void returnsExplicitEmptyReviewResultAsJson() throws Exception {
        when(useCase.execute(any(RetrieveKnowledge.Input.class)))
                .thenReturn(() -> new KnowledgeResult("EMPTY", "No indexed reviews", "version", List.of()));
        mvc.perform(get("/api/knowledge/reviews").accept("text/html,application/xhtml+xml,*/*;q=0.8"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.status").value("EMPTY"));
    }

    @Test
    void rejectsInvalidGraphQueryParameters() throws Exception {
        mvc.perform(get("/api/knowledge/capabilities")
                        .param("attributeCode", "camera_360")
                        .param("limit", "500"))
                .andExpect(status().isUnprocessableContent());
    }

    @Test
    void rejectsMalformedEvidenceId() throws Exception {
        mvc.perform(get("/api/knowledge/evidence/not-an-id")).andExpect(status().isBadRequest());
    }
}
