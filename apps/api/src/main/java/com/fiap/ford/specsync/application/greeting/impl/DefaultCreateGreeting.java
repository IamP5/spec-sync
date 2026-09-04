package com.fiap.ford.specsync.application.greeting.impl;

import com.fiap.ford.specsync.application.greeting.CreateGreeting;
import com.fiap.ford.specsync.domain.greeting.Greeting;
import com.fiap.ford.specsync.domain.greeting.HashGateway;
import java.util.Objects;
import org.springframework.stereotype.Service;

/** Reference {@code Default*} implementation: constructor-injected ports, no framework logic. */
@Service
public class DefaultCreateGreeting extends CreateGreeting {

    private final HashGateway hashGateway;

    public DefaultCreateGreeting(final HashGateway hashGateway) {
        this.hashGateway = Objects.requireNonNull(hashGateway);
    }

    @Override
    public Output execute(final Input input) {
        final var greeting = Greeting.newGreeting(input.name(), hashGateway.nextHash());
        return new StdOutput(greeting.message(), greeting.id().value());
    }

    record StdOutput(String message, String hash) implements Output {}
}
