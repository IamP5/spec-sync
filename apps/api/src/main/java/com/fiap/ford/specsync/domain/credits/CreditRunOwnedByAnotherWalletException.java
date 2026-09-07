package com.fiap.ford.specsync.domain.credits;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.validation.Error;
import java.util.List;

/**
 * The run id is already in use by another wallet. Run ids are global keys, so this is a collision
 * or a misrouted replay, never a missing run: the caller must not be told the run does not exist
 * and must not retry it under this wallet. Mapped to HTTP 409.
 */
public class CreditRunOwnedByAnotherWalletException extends DomainException {

    public CreditRunOwnedByAnotherWalletException(final String runId) {
        super(
                "Run %s belongs to another wallet".formatted(runId),
                List.of(new Error("runId", "Run %s belongs to another wallet".formatted(runId))));
    }
}
