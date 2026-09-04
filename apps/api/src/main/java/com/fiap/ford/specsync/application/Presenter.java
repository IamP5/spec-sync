package com.fiap.ford.specsync.application;

import java.util.function.Function;

/**
 * Maps a use-case output to the shape a caller needs. Web controllers pass a response constructor
 * reference, e.g. {@code useCase.execute(input, GreetingResponse::from)}.
 */
public interface Presenter<UC_OUT, NEW_OUT> extends Function<UC_OUT, NEW_OUT> {}
