package com.fiap.ford.specsync.domain.greeting;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import org.junit.jupiter.api.Test;

class GreetingTest {

    @Test
    void createsGreetingWithTrimmedNameAndHashAsId() {
        final var greeting = Greeting.newGreeting("  Tuba ", "abc123");

        assertEquals("Tuba", greeting.name());
        assertEquals("Hello, Tuba, from api", greeting.message());
        assertEquals(new GreetingId("abc123"), greeting.id());
    }

    @Test
    void rejectsBlankName() {
        final var error = assertThrows(DomainException.class, () -> Greeting.newGreeting("   ", "abc123"));

        assertEquals("name", error.errors().getFirst().property());
    }

    @Test
    void rejectsNameLongerThanMaxLength() {
        final var name = "a".repeat(Greeting.NAME_MAX_LENGTH + 1);

        final var error = assertThrows(DomainException.class, () -> Greeting.newGreeting(name, "abc123"));

        assertEquals("name", error.errors().getFirst().property());
    }
}
