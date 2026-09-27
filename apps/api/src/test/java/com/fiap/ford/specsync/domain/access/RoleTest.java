package com.fiap.ford.specsync.domain.access;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class RoleTest {

    @Test
    void grantsUserToEveryCaller() {
        assertEquals(EnumSet.of(Role.USER), Role.fromClaims(null));
        assertEquals(EnumSet.of(Role.USER), Role.fromClaims(List.of()));
    }

    @Test
    void readsKnownClaimsAndIgnoresUnknownOnes() {
        assertEquals(EnumSet.of(Role.USER, Role.CURATOR), Role.fromClaims(List.of("curator", "reviewer", "CURATOR")));
    }

    @Test
    void callerRequiresAUidAndAnExpiry() {
        assertThrows(DomainException.class, () -> new Caller(" ", null, Set.of(Role.USER), Instant.now()));
        assertThrows(DomainException.class, () -> new Caller("uid", null, Set.of(Role.USER), null));
    }

    @Test
    void callerKnowsItsRoles() {
        final var caller = new Caller("uid", "a@b.c", Role.fromClaims(List.of("admin")), Instant.now());

        assertTrue(caller.has(Role.ADMIN));
        assertTrue(caller.has(Role.USER));
    }
}
