package com.fiap.ford.specsync.domain.exceptions;

import com.fiap.ford.specsync.domain.validation.Error;
import java.util.List;

/**
 * A domain invariant was violated. Carries the list of {@link Error}s so the web layer can report
 * every failed property at once (HTTP 422, see {@code GlobalExceptionHandler}).
 */
public class DomainException extends NoStacktraceException {

    private final List<Error> errors;

    protected DomainException(final String message, final List<Error> errors) {
        super(message);
        this.errors = List.copyOf(errors);
    }

    public static DomainException with(final Error error) {
        return new DomainException(error.message(), List.of(error));
    }

    public static DomainException with(final List<Error> errors) {
        return new DomainException(errors.isEmpty() ? "" : errors.getFirst().message(), errors);
    }

    public static DomainException notFound(final Class<?> aggregate, final Object id) {
        final var message = "%s with id %s was not found".formatted(aggregate.getSimpleName(), id);
        return new DomainException(message, List.of(new Error("id", message)));
    }

    public List<Error> errors() {
        return errors;
    }
}
