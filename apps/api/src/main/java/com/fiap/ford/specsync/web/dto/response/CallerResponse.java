package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.access.GetCurrentCaller;
import java.time.Instant;
import java.util.List;

/** The caller of a request; {@code roles} is ordered from most to least privileged. */
public record CallerResponse(String uid, String email, List<String> roles, Instant expiresAt) {

    public static CallerResponse from(final GetCurrentCaller.Output output) {
        return new CallerResponse(
                output.caller().uid(),
                output.caller().email(),
                output.roles().stream().map(Enum::name).toList(),
                output.caller().expiresAt());
    }
}
