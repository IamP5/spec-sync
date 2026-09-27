package com.fiap.ford.specsync.domain.access;

import com.fiap.ford.specsync.domain.shared.AssertionConcern;
import com.fiap.ford.specsync.domain.shared.ValueObject;
import java.time.Instant;
import java.util.Set;

/**
 * The user behind a request, as asserted by a token the gateway authenticated and this API
 * verified. The API never authenticates users itself; it only reads these facts to authorise.
 *
 * @param uid stable user id (the token's {@code sub})
 * @param email verified e-mail, may be {@code null} for tokens without one
 * @param roles effective roles, always including {@link Role#USER}
 * @param expiresAt when the token stops being accepted
 */
public record Caller(String uid, String email, Set<Role> roles, Instant expiresAt)
        implements ValueObject, AssertionConcern {

    public Caller {
        assertArgumentNotEmpty(uid, "uid", "'uid' should not be empty");
        assertArgumentNotNull(roles, "roles", "'roles' should not be null");
        assertArgumentNotNull(expiresAt, "expiresAt", "'expiresAt' should not be null");
        roles = Set.copyOf(roles);
    }

    public boolean has(final Role role) {
        return roles.contains(role);
    }
}
