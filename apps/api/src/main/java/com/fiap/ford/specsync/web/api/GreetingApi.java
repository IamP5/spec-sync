package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.response.GreetingResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * HTTP contract of the greeting endpoint. The {@code *Api} interface owns the mappings and the
 * OpenAPI annotations; the controller only implements it.
 */
@Tag(name = "Greeting")
@RequestMapping("/api/greeting")
public interface GreetingApi {

    @Operation(summary = "Create a greeting for a name")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Greeting created"),
        @ApiResponse(responseCode = "422", description = "Name is empty or longer than 60 characters")
    })
    @GetMapping
    GreetingResponse greeting(@RequestParam String name);
}
