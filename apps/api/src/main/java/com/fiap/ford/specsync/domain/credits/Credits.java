package com.fiap.ford.specsync.domain.credits;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.shared.ValueObject;
import com.fiap.ford.specsync.domain.validation.Error;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * AI credits: what a signed-in user may still spend on model calls and what was already spent.
 *
 * <p>A wallet is an append-only ledger. Every entry is signed (grants positive, debits negative)
 * and the balance is their sum. A run reserves a <em>hold</em> up front so two runs racing for the
 * last credits cannot both be admitted; the hold shrinks with every charged step and is released
 * when the run finishes or its expiry passes.
 */
public final class Credits {

    private Credits() {}

    /** Promotional grant every user receives once, on first contact with the wallet. */
    public static final CreditAmount SIGNUP_GRANT = CreditAmount.of(500_000_000L);

    /** Ledger key of the signup grant; its uniqueness is what makes the grant idempotent. */
    public static final String SIGNUP_GRANT_KEY_PREFIX = "grant:signup:";

    /** How long a hold survives without a finish call before it stops counting against a wallet. */
    public static final Duration HOLD_TTL = Duration.ofMinutes(10);

    /** Runs returned in the wallet view, newest first. */
    public static final int RECENT_RUNS = 20;

    /** Uncached input tokens a minimum useful answer is assumed to consume. */
    public static final long MINIMUM_INPUT_TOKENS = 4_000L;

    /** Output tokens a minimum useful answer is assumed to consume. */
    public static final long MINIMUM_OUTPUT_TOKENS = 1_000L;

    /** Uncached input tokens a whole run is assumed to consume at most, for the hold. */
    public static final long HOLD_INPUT_TOKENS = 30_000L;

    /** Output tokens a whole run is assumed to consume at most, for the hold. */
    public static final long HOLD_OUTPUT_TOKENS = 8_000L;

    public static void require(final boolean valid, final String property, final String message) {
        if (!valid) {
            throw DomainException.with(new Error(property, message));
        }
    }

    /** Kinds of ledger entry. Only {@code GRANT} and {@code DEBIT} are written by this release. */
    public enum LedgerKind {
        GRANT,
        DEBIT,
        REFUND,
        ADJUSTMENT
    }

    /** Lifecycle of one metered run. Everything but {@code OPEN} is terminal. */
    public enum RunStatus {
        OPEN,
        COMPLETED,
        STOPPED,
        FAILED,
        EXHAUSTED;

        public boolean isOpen() {
            return this == OPEN;
        }

        /** Parses a status a client may end a run with; {@code OPEN} is not one of them. */
        public static RunStatus finishing(final String value) {
            require(value != null && !value.isBlank(), "status", "A run status is required");
            final RunStatus status;
            try {
                status = valueOf(value.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException notAStatus) {
                throw DomainException.with(new Error("status", "Unknown run status '%s'".formatted(value)));
            }
            require(!status.isOpen(), "status", "A run cannot be finished as OPEN");
            return status;
        }

        public static RunStatus of(final String value) {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        }
    }

    /** One signed movement of the ledger. Never updated nor deleted (see the V7 trigger). */
    public record LedgerEntry(
            WalletId uid, String entryKey, LedgerKind kind, CreditAmount amount, String description, Instant createdAt)
            implements ValueObject {}

    /**
     * The published price of one model, in micro-credits per million tokens. Versioned and revised
     * prospectively: a run is stamped with the version that priced it.
     */
    public record ModelTariff(
            String provider,
            String modelId,
            int version,
            CreditAmount inputPerMillion,
            CreditAmount cachedInputPerMillion,
            CreditAmount outputPerMillion,
            Instant effectiveFrom,
            boolean active)
            implements ValueObject {

        public ModelTariff {
            require(provider != null && !provider.isBlank(), "provider", "A tariff provider is required");
            require(modelId != null && !modelId.isBlank(), "modelId", "A tariff model id is required");
            require(version > 0, "version", "A tariff version starts at 1");
        }

        public boolean prices(final String otherProvider, final String otherModelId) {
            return provider.equals(otherProvider) && modelId.equals(otherModelId);
        }

        /**
         * Price of one model call. Every term is rounded up on its own so a charge is never lower
         * than the published rate, and the whole computation stays in integer arithmetic.
         */
        public CreditAmount charge(final long inputTokens, final long cachedInputTokens, final long outputTokens) {
            require(
                    inputTokens >= 0 && cachedInputTokens >= 0 && outputTokens >= 0,
                    "tokens",
                    "Token counts must not be negative");
            final var uncached = Math.max(0L, inputTokens - cachedInputTokens);
            final var billedCached = Math.min(inputTokens, cachedInputTokens);
            return CreditAmount.perMillion(uncached, inputPerMillion.micros())
                    .plus(CreditAmount.perMillion(billedCached, cachedInputPerMillion.micros()))
                    .plus(CreditAmount.perMillion(outputTokens, outputPerMillion.micros()));
        }

        /** What a minimum useful answer costs on this model. Admission compares against it. */
        public CreditAmount minimumCharge() {
            return charge(MINIMUM_INPUT_TOKENS, 0, MINIMUM_OUTPUT_TOKENS);
        }

        /** Upper bound of what one run may reserve while it is open. */
        public CreditAmount holdCap() {
            return charge(HOLD_INPUT_TOKENS, 0, HOLD_OUTPUT_TOKENS);
        }
    }

    /** One charged step of a run, identified by the caller's step key so replays cannot double-charge. */
    public record RunStep(
            String stepKey,
            String provider,
            String modelId,
            long inputTokens,
            long cachedInputTokens,
            long outputTokens,
            long reasoningTokens,
            boolean estimated,
            CreditAmount charge,
            Instant createdAt)
            implements ValueObject {

        public RunStep {
            require(
                    stepKey != null && !stepKey.isBlank() && stepKey.length() <= 200,
                    "stepKey",
                    "A step key is required (maximum 200 characters)");
        }
    }

    /** A metered agent run: one chat turn on one model. */
    public record CreditRun(
            String runId,
            WalletId uid,
            String threadId,
            String provider,
            String modelId,
            Integer tariffVersion,
            RunStatus status,
            CreditAmount hold,
            Instant holdExpiresAt,
            CreditAmount charge,
            Instant startedAt,
            Instant finishedAt)
            implements ValueObject {}

    /** The wallet view every read endpoint returns. */
    public record Wallet(
            WalletId uid,
            CreditAmount balance,
            CreditAmount holds,
            CreditAmount granted,
            CreditAmount spent,
            List<CreditRun> recentRuns)
            implements ValueObject {

        public Wallet {
            recentRuns = recentRuns == null ? List.of() : List.copyOf(recentRuns);
        }

        /** What may still be committed: the balance minus the holds of open, unexpired runs. */
        public CreditAmount available() {
            return balance.minus(holds);
        }

        public boolean exhausted() {
            return !available().isPositive();
        }
    }

    /** The outcome of admitting a run: its hold and the wallet numbers after it was taken. */
    public record Admission(
            String runId, CreditAmount hold, CreditAmount balance, CreditAmount available, boolean exhausted)
            implements ValueObject {}

    /** The outcome of charging one step. */
    public record Usage(CreditAmount charge, CreditAmount balance, CreditAmount available, boolean exhausted)
            implements ValueObject {}

    /**
     * Strict admission: a run starts only when the wallet still covers a minimum useful answer on
     * the selected model. The rejection names the models whose minimum does fit, cheapest first, so
     * the browser can offer a switch instead of silently downgrading.
     */
    public static void admit(
            final CreditAmount available, final ModelTariff tariff, final List<ModelTariff> activeTariffs) {
        final var minimum = tariff.minimumCharge();
        if (available.micros() >= minimum.micros()) {
            return;
        }
        final var cheaper = activeTariffs.stream()
                .filter(other -> !other.prices(tariff.provider(), tariff.modelId()))
                .filter(other -> available.micros() >= other.minimumCharge().micros())
                .sorted(Comparator.comparingLong(other -> other.minimumCharge().micros()))
                .map(ModelTariff::modelId)
                .distinct()
                .toList();
        throw new InsufficientCreditsException(available, minimum, cheaper);
    }

    /** What an admitted run reserves: everything that is left, capped at one run's worth. */
    public static CreditAmount hold(final CreditAmount available, final ModelTariff tariff) {
        return available.max(CreditAmount.ZERO).min(tariff.holdCap());
    }
}
