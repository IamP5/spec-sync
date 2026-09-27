package com.fiap.ford.specsync.application.access.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fiap.ford.specsync.application.access.GetCurrentCaller;
import com.fiap.ford.specsync.domain.access.Role;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class DefaultGetCurrentCallerTest {

    private final GetCurrentCaller useCase = new DefaultGetCurrentCaller();

    @Test
    void describesTheCallerWithRolesMostPrivilegedFirst() {
        final var expiry = Instant.parse("2026-09-27T13:00:00Z");

        final var output =
                useCase.execute(new GetCurrentCaller.Input("uid-1", "a@b.c", List.of("curator", "admin"), expiry));

        assertEquals("uid-1", output.caller().uid());
        assertEquals(expiry, output.caller().expiresAt());
        assertEquals(List.of(Role.ADMIN, Role.CURATOR, Role.USER), output.roles());
    }
}
