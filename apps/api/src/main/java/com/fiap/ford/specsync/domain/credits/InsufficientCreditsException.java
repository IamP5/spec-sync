package com.fiap.ford.specsync.domain.credits;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.validation.Error;
import java.util.List;

/**
 * Strict admission rejected a run: the wallet no longer covers a minimum useful answer on the
 * selected model. Carries what the browser needs to react — how much is left, what the model would
 * cost at minimum and which models still fit — and is mapped to HTTP 402 by the
 * {@code GlobalExceptionHandler}.
 */
public class InsufficientCreditsException extends DomainException {

    /** Stable machine-readable code of the problem body; the AI service and the browser match on it. */
    public static final String CODE = "INSUFFICIENT_CREDITS";

    private final CreditAmount available;
    private final CreditAmount minimumCharge;
    private final List<String> cheaperModels;

    public InsufficientCreditsException(
            final CreditAmount available, final CreditAmount minimumCharge, final List<String> cheaperModels) {
        super(
                "The available AI credits do not cover a reply on this model",
                List.of(new Error("available", "The available AI credits do not cover a reply on this model")));
        this.available = available;
        this.minimumCharge = minimumCharge;
        this.cheaperModels = cheaperModels == null ? List.of() : List.copyOf(cheaperModels);
    }

    public CreditAmount available() {
        return available;
    }

    public CreditAmount minimumCharge() {
        return minimumCharge;
    }

    public List<String> cheaperModels() {
        return cheaperModels;
    }
}
