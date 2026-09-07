package com.fiap.ford.specsync.domain.credits;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.shared.ValueObject;
import com.fiap.ford.specsync.domain.validation.Error;

/**
 * An amount of AI credits in micro-credits (1 credit = 1_000_000, and 1 credit is USD 0.01).
 * Integer arithmetic only: an amount never becomes a {@code BigDecimal} or a {@code double}
 * anywhere in this application, so rounding stays explicit at the single place that computes a
 * charge ({@link Credits.ModelTariff}).
 *
 * <p>Amounts may be negative: the balance can dip below zero after the step that exhausts a wallet.
 */
public record CreditAmount(long micros) implements ValueObject {

    /** One credit in micro-credits. */
    public static final long MICROS_PER_CREDIT = 1_000_000L;

    public static final CreditAmount ZERO = new CreditAmount(0);

    public static CreditAmount of(final long micros) {
        return new CreditAmount(micros);
    }

    public CreditAmount plus(final CreditAmount other) {
        return new CreditAmount(Math.addExact(micros, other.micros));
    }

    public CreditAmount minus(final CreditAmount other) {
        return new CreditAmount(Math.subtractExact(micros, other.micros));
    }

    public boolean isPositive() {
        return micros > 0;
    }

    public boolean isNegative() {
        return micros < 0;
    }

    public CreditAmount max(final CreditAmount other) {
        return micros >= other.micros ? this : other;
    }

    public CreditAmount min(final CreditAmount other) {
        return micros <= other.micros ? this : other;
    }

    /** Ceiling of {@code tokens * pricePerMillion / 1_000_000}: never undercharge by a fraction. */
    static CreditAmount perMillion(final long tokens, final long pricePerMillion) {
        if (tokens < 0 || pricePerMillion < 0) {
            throw DomainException.with(new Error("tokens", "Token counts and prices must not be negative"));
        }
        final var product = Math.multiplyExact(tokens, pricePerMillion);
        return new CreditAmount(Math.ceilDiv(product, MICROS_PER_CREDIT));
    }
}
