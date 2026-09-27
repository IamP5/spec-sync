package com.fiap.ford.specsync.infrastructure.configuration;

import com.fiap.ford.specsync.domain.credits.CreditRunClosedException;
import com.fiap.ford.specsync.domain.credits.CreditRunNotFoundException;
import com.fiap.ford.specsync.domain.credits.CreditRunOwnedByAnotherWalletException;
import com.fiap.ford.specsync.domain.credits.InsufficientCreditsException;
import com.fiap.ford.specsync.domain.credits.UnpricedModelException;
import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.validation.Error;
import java.net.URI;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

/**
 * Single place that maps failures to HTTP. Controllers never catch {@link DomainException}; a
 * violated invariant becomes an RFC 9457 problem with the list of failed properties. Every error
 * body has the same shape ({@code type}, {@code title}, {@code status}, {@code detail}, {@code
 * instance}, plus {@code errors} when properties failed):
 *
 * <ul>
 *   <li>400 malformed request (Bean Validation, missing or unparsable parameter);
 *   <li>401 / 403 missing token / insufficient role ({@link ProblemResponses}, before any
 *       controller runs);
 *   <li>402, 404, 409, 422 domain outcomes below;
 *   <li>405, 406, 415 Spring MVC defaults of {@code ResponseEntityExceptionHandler};
 *   <li>500 anything unexpected, without internals.
 * </ul>
 */
@RestControllerAdvice
public class GlobalExceptionHandler
        extends org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Bean Validation on a request body: 400 with the same {@code errors} list as a 422. */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            final MethodArgumentNotValidException exception,
            final HttpHeaders headers,
            final HttpStatusCode status,
            final WebRequest request) {
        final var problem = exception.getBody();
        problem.setDetail("The request is invalid");
        problem.setProperty(
                "errors",
                exception.getBindingResult().getFieldErrors().stream()
                        .map(error -> new Error(error.getField(), error.getDefaultMessage()))
                        .toList());
        return handleExceptionInternal(exception, problem, headers, status, request);
    }

    /** Bean Validation on parameters (e.g. {@code @Size} on a query parameter). */
    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(
            final HandlerMethodValidationException exception,
            final HttpHeaders headers,
            final HttpStatusCode status,
            final WebRequest request) {
        final var problem = exception.getBody();
        problem.setDetail("The request is invalid");
        problem.setProperty(
                "errors",
                exception.getParameterValidationResults().stream()
                        .flatMap(result -> result.getResolvableErrors().stream()
                                .map(error -> new Error(
                                        result.getMethodParameter().getParameterName(), error.getDefaultMessage())))
                        .toList());
        return handleExceptionInternal(exception, problem, headers, status, request);
    }

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

    /** Authorisation refused inside a handler (the filter chain answers most 403s itself). */
    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail handleAccessDenied(final AccessDeniedException exception) {
        final var problem =
                ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "Your roles do not allow this operation");
        problem.setTitle(HttpStatus.FORBIDDEN.getReasonPhrase());
        return problem;
    }

    /** Last resort: log the cause, answer a generic 500 that leaks no internals. */
    @ExceptionHandler(Exception.class)
    ProblemDetail handleUnexpected(final Exception exception) {
        LOG.error("Unhandled exception", exception);
        final var problem =
                ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred");
        problem.setTitle(HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase());
        problem.setProperty("errors", List.of());
        return problem;
    }
}
