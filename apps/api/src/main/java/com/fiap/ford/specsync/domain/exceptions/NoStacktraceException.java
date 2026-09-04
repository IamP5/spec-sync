package com.fiap.ford.specsync.domain.exceptions;

/**
 * Base for expected business failures. Stack traces are disabled because these exceptions are
 * control flow (a rejected command), not defects, and filling them is costly.
 */
public class NoStacktraceException extends RuntimeException {

    public NoStacktraceException(final String message) {
        this(message, null);
    }

    public NoStacktraceException(final String message, final Throwable cause) {
        super(message, cause, true, false);
    }
}
