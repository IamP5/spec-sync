package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.greeting.CreateGreeting;

/** Outbound DTO consumed by {@code apps/web} (see its {@code Greeting} model). */
public record GreetingResponse(String message, String hash) {

    public static GreetingResponse from(final CreateGreeting.Output output) {
        return new GreetingResponse(output.message(), output.hash());
    }
}
