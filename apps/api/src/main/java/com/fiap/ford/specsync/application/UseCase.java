package com.fiap.ford.specsync.application;

/**
 * Inbound port with input and output. Each use case is an abstract class in {@code
 * application.<aggregate>} with nested {@code Input} record and {@code Output} interface; the
 * concrete {@code Default*} implementation lives in the {@code impl} sub-package.
 */
public abstract class UseCase<IN, OUT> {

    public abstract OUT execute(IN input);

    public <T> T execute(final IN input, final Presenter<OUT, T> presenter) {
        return presenter.apply(execute(input));
    }
}
