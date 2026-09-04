package com.fiap.ford.specsync.domain.greeting;

import com.fiap.ford.specsync.domain.shared.AggregateRoot;

/**
 * Reference aggregate of this API. A greeting is created for a person's name; the domain owns the
 * name invariants and the wording of the message.
 */
public class Greeting extends AggregateRoot<GreetingId> {

    public static final int NAME_MAX_LENGTH = 60;

    private final String name;
    private final String message;

    private Greeting(final GreetingId id, final String name) {
        super(id);
        assertArgumentNotEmpty(name, "name", "'name' should not be empty");
        assertArgumentMaxLength(
                name, NAME_MAX_LENGTH, "name", "'name' must contain at most %d characters".formatted(NAME_MAX_LENGTH));
        this.name = name;
        this.message = "Hello, %s, from api".formatted(name);
    }

    public static Greeting newGreeting(final String name, final String hash) {
        final var normalizedName = name == null ? null : name.trim();
        return new Greeting(GreetingId.from(hash), normalizedName);
    }

    public String name() {
        return name;
    }

    public String message() {
        return message;
    }
}
