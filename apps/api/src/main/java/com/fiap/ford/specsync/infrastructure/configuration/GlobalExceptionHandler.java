package com.fiap.ford.specsync.infrastructure.configuration;

import com.fiap.ford.specsync.domain.credits.CreditRunClosedException;
import com.fiap.ford.specsync.domain.credits.CreditRunNotFoundException;
import com.fiap.ford.specsync.domain.credits.CreditRunOwnedByAnotherWalletException;
import com.fiap.ford.specsync.domain.credits.InsufficientCreditsException;
import com.fiap.ford.specsync.domain.credits.UnpricedModelException;
import com.fiap.ford.specsync.domain.exceptions.DomainException;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Single place that maps domain failures to HTTP. Controllers never catch {@link DomainException};
 * a violated invariant becomes an RFC 9457 problem with the list of failed properties.
 */
@RestControllerAdvice
public class GlobalExceptionHandler
        extends org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler {

    @ExceptionHandler(DomainException.class)
    ProblemDetail handleDomainException(final DomainException exception) {
        final var problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_CONTENT, exception.getMessage());
        problem.setTitle("Business rule violated");
        problem.setProperty("errors", exception.errors());
        return problem;
    }

    /**
     * Strict admission rejected the run. 402 is the one status the browser reacts to specially, so
     * the body also carries the machine-readable code and the models that still fit.
     */
    @ExceptionHandler(InsufficientCreditsException.class)
    ProblemDetail handleInsufficientCredits(final InsufficientCreditsException exception) {
        final var problem = ProblemDetail.forStatusAndDetail(HttpStatus.PAYMENT_REQUIRED, exception.getMessage());
        problem.setTitle("Insufficient AI credits");
        problem.setProperty("code", InsufficientCreditsException.CODE);
        problem.setProperty("available", exception.available().micros());
        problem.setProperty("minimumCharge", exception.minimumCharge().micros());
        problem.setProperty("cheaperModels", exception.cheaperModels());
        problem.setProperty("errors", exception.errors());
        return problem;
    }

    /** A model without an active tariff is never offered and never charged. */
    @ExceptionHandler(UnpricedModelException.class)
    ProblemDetail handleUnpricedModel(final UnpricedModelException exception) {
        final var problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_CONTENT, exception.getMessage());
        problem.setType(URI.create("/problems/unpriced-model"));
        problem.setTitle("Model has no published price");
        problem.setProperty("provider", exception.provider());
        problem.setProperty("modelId", exception.modelId());
        problem.setProperty("errors", exception.errors());
        return problem;
    }

    @ExceptionHandler(CreditRunNotFoundException.class)
    ProblemDetail handleCreditRunNotFound(final CreditRunNotFoundException exception) {
        final var problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
        problem.setTitle("Run not found");
        problem.setProperty("errors", exception.errors());
        return problem;
    }

    /** The run id is taken by another wallet: a conflict, never a run this wallet may start. */
    @ExceptionHandler(CreditRunOwnedByAnotherWalletException.class)
    ProblemDetail handleCreditRunOwnedByAnotherWallet(final CreditRunOwnedByAnotherWalletException exception) {
        final var problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
        problem.setTitle("Run id already in use");
        problem.setProperty("errors", exception.errors());
        return problem;
    }

    @ExceptionHandler(CreditRunClosedException.class)
    ProblemDetail handleCreditRunClosed(final CreditRunClosedException exception) {
        final var problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
        problem.setTitle("Run already finished");
        problem.setProperty("errors", exception.errors());
        return problem;
    }
}
