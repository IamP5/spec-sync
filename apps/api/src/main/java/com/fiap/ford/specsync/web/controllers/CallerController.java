package com.fiap.ford.specsync.web.controllers;

import com.fiap.ford.specsync.application.access.GetCurrentCaller;
import com.fiap.ford.specsync.web.api.CallerApi;
import com.fiap.ford.specsync.web.dto.response.CallerResponse;
import java.util.List;
import java.util.Objects;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CallerController implements CallerApi {

    private final GetCurrentCaller getCurrentCaller;

    public CallerController(final GetCurrentCaller getCurrentCaller) {
        this.getCurrentCaller = Objects.requireNonNull(getCurrentCaller);
    }

    @Override
    public CallerResponse me(final Jwt token) {
        final var roles = token.hasClaim("roles") ? token.getClaimAsStringList("roles") : List.<String>of();
        return getCurrentCaller.execute(
                new GetCurrentCaller.Input(
                        token.getSubject(), token.getClaimAsString("email"), roles, token.getExpiresAt()),
                CallerResponse::from);
    }
}
