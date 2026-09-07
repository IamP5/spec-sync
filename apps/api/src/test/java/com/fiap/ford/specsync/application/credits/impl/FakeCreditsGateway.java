package com.fiap.ford.specsync.application.credits.impl;

import com.fiap.ford.specsync.domain.credits.CreditAmount;
import com.fiap.ford.specsync.domain.credits.Credits;
import com.fiap.ford.specsync.domain.credits.CreditsGateway;
import com.fiap.ford.specsync.domain.credits.WalletId;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * In-memory stand-in for the wallet: enough behaviour to prove what the use cases do with it, and
 * nothing of the locking and idempotency the real adapter owns (that is {@code CreditsJdbcGatewayIT}).
 */
final class FakeCreditsGateway implements CreditsGateway {

    static final Credits.ModelTariff FLASH = new Credits.ModelTariff(
            "vertex",
            "gemini-2.5-flash",
            1,
            CreditAmount.of(1_500_000),
            CreditAmount.of(375_000),
            CreditAmount.of(12_500_000),
            Instant.parse("2026-09-07T00:00:00Z"),
            true);

    private final List<WalletId> walletCalls = new ArrayList<>();
    private final List<String> finished = new ArrayList<>();
    private final Map<String, Credits.RunStep> steps = new LinkedHashMap<>();

    private CreditAmount balance = Credits.SIGNUP_GRANT;
    private CreditAmount holds = CreditAmount.ZERO;
    private List<Credits.ModelTariff> tariffs = List.of(FLASH);
    private final List<Credits.CreditRun> runs = new ArrayList<>();

    void balance(final CreditAmount value) {
        this.balance = value;
    }

    void holds(final CreditAmount value) {
        this.holds = value;
    }

    void tariffs(final List<Credits.ModelTariff> value) {
        this.tariffs = value;
    }

    List<WalletId> walletCalls() {
        return walletCalls;
    }

    List<String> finished() {
        return finished;
    }

    Map<String, Credits.RunStep> steps() {
        return steps;
    }

    @Override
    public Credits.Wallet wallet(final WalletId uid) {
        walletCalls.add(uid);
        return new Credits.Wallet(uid, balance, holds, Credits.SIGNUP_GRANT, Credits.SIGNUP_GRANT.minus(balance), runs);
    }

    @Override
    public List<Credits.ModelTariff> tariffs() {
        return tariffs;
    }

    @Override
    public Credits.Admission startRun(
            final WalletId uid,
            final String runId,
            final String provider,
            final String modelId,
            final String threadId) {
        final var tariff = tariffs.stream()
                .filter(candidate -> candidate.prices(provider, modelId))
                .findFirst()
                .orElseThrow();
        final var available = balance.minus(holds);
        Credits.admit(available, tariff, tariffs);
        final var hold = Credits.hold(available, tariff);
        holds = holds.plus(hold);
        return new Credits.Admission(
                runId,
                hold,
                balance,
                balance.minus(holds),
                !balance.minus(holds).isPositive());
    }

    @Override
    public Credits.Usage recordUsage(final WalletId uid, final String runId, final Credits.RunStep step) {
        steps.put(step.stepKey(), step);
        final var tariff = tariffs.getFirst();
        final var charge = tariff.charge(step.inputTokens(), step.cachedInputTokens(), step.outputTokens());
        balance = balance.minus(charge);
        return new Credits.Usage(
                charge, balance, balance.minus(holds), !balance.minus(holds).isPositive());
    }

    @Override
    public Credits.Wallet finishRun(final WalletId uid, final String runId, final Credits.RunStatus status) {
        finished.add("%s:%s".formatted(runId, status));
        holds = CreditAmount.ZERO;
        return wallet(uid);
    }
}
