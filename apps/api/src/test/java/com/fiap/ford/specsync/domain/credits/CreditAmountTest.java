package com.fiap.ford.specsync.domain.credits;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class CreditAmountTest {

    @Test
    void addsAndSubtractsInMicroCredits() {
        assertEquals(CreditAmount.of(7_320_000), CreditAmount.of(10_000_000).minus(CreditAmount.of(2_680_000)));
        assertEquals(CreditAmount.of(10_000_000), CreditAmount.of(9_999_999).plus(CreditAmount.of(1)));
    }

    @Test
    void treatsOnlyStrictlyPositiveAmountsAsPositive() {
        assertTrue(CreditAmount.of(1).isPositive());
        assertFalse(CreditAmount.ZERO.isPositive());
        assertFalse(CreditAmount.of(-1).isPositive());
        assertTrue(CreditAmount.of(-1).isNegative());
    }

    @Test
    void picksTheLargerAndTheSmallerAmount() {
        assertEquals(CreditAmount.of(5), CreditAmount.of(5).max(CreditAmount.of(-5)));
        assertEquals(CreditAmount.of(-5), CreditAmount.of(5).min(CreditAmount.of(-5)));
        assertEquals(CreditAmount.ZERO, CreditAmount.of(-42).max(CreditAmount.ZERO));
    }

    @Test
    void allowsNegativeBalancesAfterTheExhaustingStep() {
        assertEquals(CreditAmount.of(-2_000), CreditAmount.of(1_000).minus(CreditAmount.of(3_000)));
    }
}
