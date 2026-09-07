package com.fiap.ford.specsync.domain.credits;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class CreditsTest {

    // An illustrative rate card in micro-credits per million tokens.
    private static final Credits.ModelTariff FLASH = tariff("gemini-2.5-flash", 1_500_000, 375_000, 12_500_000);
    private static final Credits.ModelTariff PRO = tariff("gemini-2.5-pro", 6_250_000, 1_562_500, 50_000_000);
    private static final Credits.ModelTariff LITE = tariff("gemini-2.5-flash-lite", 500_000, 125_000, 2_000_000);

    private static Credits.ModelTariff tariff(
            final String modelId, final long input, final long cachedInput, final long output) {
        return new Credits.ModelTariff(
                "vertex",
                modelId,
                1,
                CreditAmount.of(input),
                CreditAmount.of(cachedInput),
                CreditAmount.of(output),
                Instant.parse("2026-09-07T00:00:00Z"),
                true);
    }

    @Test
    void chargesEveryTermAtItsOwnRate() {
        // 5_120 uncached input + 640 output on the flash rate card.
        assertEquals(
                CreditAmount.of(5_120 * 1_500_000L / 1_000_000 + 640 * 12_500_000L / 1_000_000),
                FLASH.charge(5_120, 0, 640));
    }

    @Test
    void pricesTheCachedSubsetAtTheCachedRate() {
        // 5_000 input of which 4_000 were cached: 1_000 uncached + 4_000 cached + 500 output.
        final var expected = CreditAmount.of(1_000 * 1_500_000L / 1_000_000)
                .plus(CreditAmount.of(4_000 * 375_000L / 1_000_000))
                .plus(CreditAmount.of(500 * 12_500_000L / 1_000_000));
        assertEquals(expected, FLASH.charge(5_000, 4_000, 500));
        // Cached tokens are a subset of the input, so they never add on top of it.
        assertEquals(FLASH.charge(5_000, 5_000, 0), FLASH.charge(5_000, 9_999, 0));
    }

    @Test
    void roundsEveryTermUpSoAChargeNeverUndercutsTheRateCard() {
        // 1 token at 1_500_000 per million is 1.5 micro-credits and must cost 2, not 1.
        assertEquals(CreditAmount.of(2), FLASH.charge(1, 0, 0));
        // Rounding is per term, not on the sum: 2 (input) + 13 (output), not 14.
        assertEquals(CreditAmount.of(2 + 13), FLASH.charge(1, 0, 1));
    }

    @Test
    void chargesNothingForZeroTokens() {
        assertEquals(CreditAmount.ZERO, FLASH.charge(0, 0, 0));
    }

    @Test
    void rejectsNegativeTokenCounts() {
        assertThrows(DomainException.class, () -> FLASH.charge(-1, 0, 0));
    }

    @Test
    void pricesAMinimumUsefulAnswerAtFourThousandInputAndOneThousandOutput() {
        assertEquals(CreditAmount.of(18_500), FLASH.minimumCharge());
        assertEquals(CreditAmount.of(75_000), PRO.minimumCharge());
        assertEquals(CreditAmount.of(4_000), LITE.minimumCharge());
    }

    @Test
    void capsAHoldAtThirtyThousandInputAndEightThousandOutput() {
        assertEquals(CreditAmount.of(45_000 + 100_000), FLASH.holdCap());
        assertEquals(CreditAmount.of(15_000 + 16_000), LITE.holdCap());
    }

    @Test
    void admitsARunThatTheBalanceStillCovers() {
        Credits.admit(FLASH.minimumCharge(), FLASH, List.of(FLASH, PRO, LITE));
    }

    @Test
    void rejectsARunAndNamesTheModelsThatStillFitCheapestFirst() {
        final var available = CreditAmount.of(20_000);
        final var rejection = assertThrows(
                InsufficientCreditsException.class, () -> Credits.admit(available, PRO, List.of(FLASH, PRO, LITE)));
        assertEquals(available, rejection.available());
        assertEquals(CreditAmount.of(75_000), rejection.minimumCharge());
        assertEquals(List.of("gemini-2.5-flash-lite", "gemini-2.5-flash"), rejection.cheaperModels());
    }

    @Test
    void offersNoAlternativeWhenNothingFits() {
        final var rejection = assertThrows(
                InsufficientCreditsException.class,
                () -> Credits.admit(CreditAmount.ZERO, FLASH, List.of(FLASH, PRO, LITE)));
        assertEquals(List.of(), rejection.cheaperModels());
    }

    @Test
    void holdsEverythingThatIsLeftUpToOneRunsWorth() {
        assertEquals(FLASH.holdCap(), Credits.hold(CreditAmount.of(10_000_000), FLASH));
        assertEquals(CreditAmount.of(20_000), Credits.hold(CreditAmount.of(20_000), FLASH));
        assertEquals(CreditAmount.ZERO, Credits.hold(CreditAmount.of(-5_000), FLASH));
    }

    @Test
    void readsAvailableAsTheBalanceMinusTheOpenHolds() {
        final var wallet = new Credits.Wallet(
                new WalletId("abc"),
                CreditAmount.of(7_320_000),
                CreditAmount.of(145_000),
                CreditAmount.of(10_000_000),
                CreditAmount.of(2_680_000),
                List.of());
        assertEquals(CreditAmount.of(7_175_000), wallet.available());
        assertFalse(wallet.exhausted());
    }

    @Test
    void treatsANonPositiveAvailableAsExhausted() {
        final var wallet = new Credits.Wallet(
                new WalletId("abc"),
                CreditAmount.ZERO,
                CreditAmount.ZERO,
                CreditAmount.of(10_000_000),
                CreditAmount.of(10_000_000),
                List.of());
        assertTrue(wallet.exhausted());
    }

    @Test
    void acceptsOnlyTerminalStatusesToFinishARunWith() {
        assertEquals(Credits.RunStatus.EXHAUSTED, Credits.RunStatus.finishing("exhausted"));
        assertThrows(DomainException.class, () -> Credits.RunStatus.finishing("OPEN"));
        assertThrows(DomainException.class, () -> Credits.RunStatus.finishing("PENDING"));
        assertThrows(DomainException.class, () -> Credits.RunStatus.finishing(" "));
    }

    @Test
    void rejectsAWalletIdThatCouldNotIdentifyAUser() {
        assertThrows(DomainException.class, () -> WalletId.from(" "));
        assertThrows(DomainException.class, () -> WalletId.from(null));
        assertEquals("abc", WalletId.from("  abc  ").value());
    }
}
