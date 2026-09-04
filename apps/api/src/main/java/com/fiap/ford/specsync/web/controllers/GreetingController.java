package com.fiap.ford.specsync.web.controllers;

import com.fiap.ford.specsync.application.greeting.CreateGreeting;
import com.fiap.ford.specsync.web.api.GreetingApi;
import com.fiap.ford.specsync.web.dto.response.GreetingResponse;
import java.util.Objects;
import org.springframework.web.bind.annotation.RestController;

/** Reference controller: depends on the use-case abstraction and presents through the DTO. */
@RestController
public class GreetingController implements GreetingApi {

    private final CreateGreeting createGreeting;

    public GreetingController(final CreateGreeting createGreeting) {
        this.createGreeting = Objects.requireNonNull(createGreeting);
    }

    @Override
    public GreetingResponse greeting(final String name) {
        return createGreeting.execute(new CreateGreeting.Input(name), GreetingResponse::from);
    }
}
