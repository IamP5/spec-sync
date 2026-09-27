package com.fiap.ford.specsync.domain.access;

import java.util.Collection;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;

/**
 * Access profile of a caller. The gateway authenticates the user; the roles arrive as the {@code
 * roles} custom claim of the verified token (assigned by operators with {@code
 * apps/gateway/ops/set-user-roles.mjs}). Each role includes the permissions of the ones before it;
 * the hierarchy is declared once, in {@code SecurityConfiguration}.
 */
public enum Role {
    /** Every signed-in user: reads the catalog and its own profile. Implicit, never assigned. */
    USER,
    /** Reviews vehicle ingestions and activates ontology proposals. */
    CURATOR,
    /** Everything a curator may do; reserved for operators. */
    ADMIN;

    /** Claim value of this role, e.g. {@code curator}. */
    public String claim() {
        return name().toLowerCase(Locale.ROOT);
    }

    /**
     * Roles granted by a token's {@code roles} claim. {@link #USER} is always present; unknown claim
     * values are ignored rather than rejected, so a role introduced for another service never locks a
     * user out of this one.
     */
    public static Set<Role> fromClaims(final Collection<String> claims) {
        final var roles = EnumSet.of(USER);
        if (claims != null) {
            for (final var claim : claims) {
                for (final var role : values()) {
                    if (role.claim().equals(claim)) {
                        roles.add(role);
                    }
                }
            }
        }
        return roles;
    }
}
