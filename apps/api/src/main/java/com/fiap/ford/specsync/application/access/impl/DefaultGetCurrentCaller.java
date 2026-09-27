package com.fiap.ford.specsync.application.access.impl;

import com.fiap.ford.specsync.application.access.GetCurrentCaller;
import com.fiap.ford.specsync.domain.access.Caller;
import com.fiap.ford.specsync.domain.access.Role;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class DefaultGetCurrentCaller extends GetCurrentCaller {

    @Override
    public Output execute(final Input input) {
        final var caller =
                new Caller(input.uid(), input.email(), Role.fromClaims(input.roleClaims()), input.expiresAt());
        final var roles = caller.roles().stream()
                .sorted(Comparator.comparing(Role::ordinal).reversed())
                .toList();
        return new StdOutput(caller, roles);
    }

    record StdOutput(Caller caller, List<Role> roles) implements Output {}
}
