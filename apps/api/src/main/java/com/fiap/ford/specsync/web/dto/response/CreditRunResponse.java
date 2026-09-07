package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.credits.StartCreditRun;

/** What an admitted run reserved, and where that leaves the wallet. */
public record CreditRunResponse(String runId, long hold, long balance, long available, boolean exhausted) {

    public static CreditRunResponse from(final StartCreditRun.Output output) {
        return new CreditRunResponse(
                output.runId(),
                output.hold().micros(),
                output.balance().micros(),
                output.available().micros(),
                output.exhausted());
    }
}
