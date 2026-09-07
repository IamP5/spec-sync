package com.fiap.ford.specsync.web.dto.response;

import com.fiap.ford.specsync.application.credits.FinishCreditRun;
import com.fiap.ford.specsync.application.credits.GetWallet;
import com.fiap.ford.specsync.domain.credits.Credits;
import java.time.Instant;
import java.util.List;

/**
 * The wallet as the AI service and, through it, the browser see it. Amounts are micro-credits
 * (1 credit = 1_000_000); the browser formats them with its own credit formatter.
 */
public record WalletResponse(
        String uid,
        String unit,
        long balance,
        long available,
        long granted,
        long spent,
        boolean exhausted,
        List<WalletResponse.Model> models,
        List<WalletResponse.Run> recentRuns) {

    /** The only unit this release knows: AI credits, never a currency. */
    public static final String UNIT = "CREDITS";

    /** One priced model plus whether the wallet still covers a minimum useful answer on it. */
    public record Model(
            String provider,
            String modelId,
            int tariffVersion,
            long inputPerMillion,
            long cachedInputPerMillion,
            long outputPerMillion,
            long minimumCharge,
            boolean affordable) {}

    public record Run(
            String runId, Instant startedAt, Instant finishedAt, String modelId, String status, long charge) {}

    public static WalletResponse from(final GetWallet.Output output) {
        return of(output.wallet(), output.tariffs());
    }

    public static WalletResponse from(final FinishCreditRun.Output output) {
        return of(output.wallet(), output.tariffs());
    }

    private static WalletResponse of(final Credits.Wallet wallet, final List<Credits.ModelTariff> tariffs) {
        final var available = wallet.available().micros();
        return new WalletResponse(
                wallet.uid().value(),
                UNIT,
                wallet.balance().micros(),
                available,
                wallet.granted().micros(),
                wallet.spent().micros(),
                wallet.exhausted(),
                tariffs.stream()
                        .map(tariff -> new Model(
                                tariff.provider(),
                                tariff.modelId(),
                                tariff.version(),
                                tariff.inputPerMillion().micros(),
                                tariff.cachedInputPerMillion().micros(),
                                tariff.outputPerMillion().micros(),
                                tariff.minimumCharge().micros(),
                                available >= tariff.minimumCharge().micros()))
                        .toList(),
                wallet.recentRuns().stream()
                        .map(run -> new Run(
                                run.runId(),
                                run.startedAt(),
                                run.finishedAt(),
                                run.modelId(),
                                run.status().name(),
                                run.charge().micros()))
                        .toList());
    }
}
