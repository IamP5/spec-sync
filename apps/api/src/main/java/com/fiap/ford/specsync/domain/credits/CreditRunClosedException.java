package com.fiap.ford.specsync.domain.credits;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.validation.Error;
import java.util.List;

/** A step arrived after the run was closed. Charging it would be a late double charge; HTTP 409. */
public class CreditRunClosedException extends DomainException {

    public CreditRunClosedException(final String runId, final Credits.RunStatus status) {
        super(
                "Run %s is already %s".formatted(runId, status),
                List.of(new Error("runId", "Run %s is already %s".formatted(runId, status))));
    }
}
