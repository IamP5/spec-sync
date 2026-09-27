package com.fiap.ford.specsync;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/** The whole application serves its OpenAPI contract and Swagger UI without a token. */
@SpringBootTest
@AutoConfigureMockMvc
class ApiDocumentationTests {

    @Autowired
    MockMvc mvc;

    @Test
    void publishesTheOpenApiDocumentWithItsSecuritySchemes() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("SpecSync API"))
                .andExpect(jsonPath("$.components.securitySchemes.userToken.bearerFormat")
                        .value("JWT"))
                .andExpect(
                        jsonPath("$.paths['/api/me'].get.security[0].userToken").exists())
                .andExpect(jsonPath("$.paths['/api/ingestions'].post.responses['201']")
                        .exists());
    }

    @Test
    void servesSwaggerUi() throws Exception {
        mvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Swagger UI")));
    }

    @Test
    void protectsEverythingElseWithAProblem401() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("A valid bearer token is required"));
    }
}
