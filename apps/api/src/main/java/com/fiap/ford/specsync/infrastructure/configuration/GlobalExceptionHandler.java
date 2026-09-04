package com.fiap.ford.specsync.infrastructure.configuration;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Single place that maps domain failures to HTTP. Controllers never catch {@link DomainException};
 * a violated invariant becomes an RFC 9457 problem with the list of failed properties.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(DomainException.class)
    ProblemDetail handleDomainException(final DomainException exception) {
        final var problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_CONTENT, exception.getMessage());
        problem.setTitle("Business rule violated");
        problem.setProperty("errors", exception.errors());
        return problem;
    }
}
