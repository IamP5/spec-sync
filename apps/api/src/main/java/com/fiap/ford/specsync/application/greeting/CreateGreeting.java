package com.fiap.ford.specsync.application.greeting;

import com.fiap.ford.specsync.application.UseCase;

/**
 * Creates a greeting for a name. Reference use case: copy its shape (abstract class, nested {@code
 * Input} record, nested {@code Output} interface) for every new use case.
 */
public abstract class CreateGreeting extends UseCase<CreateGreeting.Input, CreateGreeting.Output> {

    public record Input(String name) {}

    public interface Output {

        String message();

        String hash();
    }
}
