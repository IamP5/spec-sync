package com.fiap.ford.specsync.application.access;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.access.Caller;
import com.fiap.ford.specsync.domain.access.Role;
import java.time.Instant;
import java.util.List;

/**
 * Describes the caller of the current request from the claims of its verified token: who it is,
 * which roles apply and until when the token is accepted.
 */
public abstract class GetCurrentCaller extends UseCase<GetCurrentCaller.Input, GetCurrentCaller.Output> {

    public record Input(String uid, String email, List<String> roleClaims, Instant expiresAt) {}

    public interface Output {

        Caller caller();

        /** Most privileged role first, e.g. {@code [ADMIN, CURATOR, USER]}. */
        List<Role> roles();
    }
}
