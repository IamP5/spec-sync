package com.fiap.ford.specsync.web.controllers;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fiap.ford.specsync.application.catalog.*;
import com.fiap.ford.specsync.domain.catalog.Catalog;
import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.validation.Error;
import com.fiap.ford.specsync.infrastructure.configuration.*;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CatalogController.class)
@Import({SecurityConfiguration.class, GlobalExceptionHandler.class})
class CatalogControllerWebMvcTest {
    private static final String BROWSER_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

    @Autowired
    MockMvc mvc;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    SearchVehicleConfigurations search;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    ListComparisonAttributes attributes;

    @MockitoBean(answers = Answers.CALLS_REAL_METHODS)
    CompareVehicles compare;

    @Test
    void exposesPublicSearchWithDefaults() throws Exception {
        when(search.execute(any(SearchVehicleConfigurations.Input.class)))
                .thenReturn(() -> new Catalog.Page(List.of(), 20, 0, false));
        mvc.perform(get("/api/vehicle-configurations").header("Accept", BROWSER_ACCEPT))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.hasMore").value(false));
        verify(search).execute(new SearchVehicleConfigurations.Input("", null, null, 20, 0));
    }

    @Test
    void exposesPublicAttributeDefinitions() throws Exception {
        when(attributes.execute(any(ListComparisonAttributes.Input.class))).thenReturn(List::of);
        mvc.perform(get("/api/comparison-attributes").header("Accept", BROWSER_ACCEPT))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    void bindsOrderedIdsAndAttributeCodes() throws Exception {
        var a = UUID.randomUUID();
        var b = UUID.randomUUID();
        when(compare.execute(any(CompareVehicles.Input.class)))
                .thenReturn(() -> new Catalog.Comparison(List.of(), List.of()));
        mvc.perform(get("/api/comparisons")
                        .param("configurationIds", a + "," + b)
                        .param("attributes", "torque_max,power_max")
                        .header("Accept", BROWSER_ACCEPT))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.rows").isArray());
        verify(compare).execute(new CompareVehicles.Input(List.of(a, b), List.of("torque_max", "power_max")));
    }

    @Test
    void rejectsMalformedOrMissingIdsBeforeUseCase() throws Exception {
        mvc.perform(get("/api/comparisons")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/comparisons").param("configurationIds", "not-a-uuid"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(compare);
    }

    @Test
    void reportsSelectionErrorsAsProblemDetails() throws Exception {
        when(compare.execute(any(CompareVehicles.Input.class)))
                .thenThrow(
                        DomainException.with(new Error("configurationIds", "Choose between 2 and 5 configurations.")));
        mvc.perform(get("/api/comparisons")
                        .param("configurationIds", UUID.randomUUID().toString()))
                .andExpect(status().isUnprocessableContent())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.errors[0].property").value("configurationIds"));
    }

    @Test
    void keepsUnrelatedRoutesProtected() throws Exception {
        mvc.perform(get("/api/private")).andExpect(status().isForbidden());
        mvc.perform(post("/api/comparisons")).andExpect(status().isForbidden());
    }
}
