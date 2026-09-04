package com.fiap.ford.specsync.application.greeting.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fiap.ford.specsync.application.greeting.CreateGreeting;
import com.fiap.ford.specsync.domain.exceptions.DomainException;
import org.junit.jupiter.api.Test;

/** Use-case tests are pure JUnit: ports are replaced by hand-written fakes, no Spring, no Mockito. */
class DefaultCreateGreetingTest {

    private final CreateGreeting useCase = new DefaultCreateGreeting(() -> "fixedhash123");

    @Test
    void createsGreetingUsingTheHashPort() {
        final var output = useCase.execute(new CreateGreeting.Input("Tuba"));

        assertEquals("Hello, Tuba, from api", output.message());
        assertEquals("fixedhash123", output.hash());
    }

    @Test
    void propagatesDomainErrors() {
        assertThrows(DomainException.class, () -> useCase.execute(new CreateGreeting.Input(" ")));
    }
}
