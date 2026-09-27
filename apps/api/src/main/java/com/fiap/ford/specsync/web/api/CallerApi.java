package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.response.CallerResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/** The authenticated caller as this API sees it: identity and roles read from the verified token. */
@Tag(name = "Caller")
@SecurityRequirement(name = "userToken")
@RequestMapping(value = "/api/me", produces = "application/json")
public interface CallerApi {

    @GetMapping
    @Operation(summary = "Describe the caller of this request: uid, e-mail, effective roles and token expiry")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Caller described from the verified token"),
        @ApiResponse(responseCode = "401", description = "Token missing, expired, tampered or not for this project")
    })
    CallerResponse me(@Parameter(hidden = true) @AuthenticationPrincipal Jwt token);
}
