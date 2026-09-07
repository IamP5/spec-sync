package com.fiap.ford.specsync.domain.credits;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.validation.Error;
import java.util.List;

/** Usage or a finish arrived for a run this wallet never started. Mapped to HTTP 404. */
public class CreditRunNotFoundException extends DomainException {

    public CreditRunNotFoundException(final String runId) {
        super(
                "Run %s was not found for this wallet".formatted(runId),
                List.of(new Error("runId", "Run %s was not found for this wallet".formatted(runId))));
    }
}
