package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.credits.RecordCreditUsage;

/** What one step cost, and where that leaves the wallet. */
public record CreditUsageResponse(long charge, long balance, long available, boolean exhausted) {

    public static CreditUsageResponse from(final RecordCreditUsage.Output output) {
        return new CreditUsageResponse(
                output.charge().micros(),
                output.balance().micros(),
                output.available().micros(),
                output.exhausted());
    }
}
