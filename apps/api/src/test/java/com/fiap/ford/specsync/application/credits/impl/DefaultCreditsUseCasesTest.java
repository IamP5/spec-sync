package com.fiap.ford.specsync.application.credits.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fiap.ford.specsync.application.credits.FinishCreditRun;
import com.fiap.ford.specsync.application.credits.GetWallet;
import com.fiap.ford.specsync.application.credits.RecordCreditUsage;
import com.fiap.ford.specsync.application.credits.StartCreditRun;
import com.fiap.ford.specsync.domain.credits.CreditAmount;
import com.fiap.ford.specsync.domain.credits.Credits;
import com.fiap.ford.specsync.domain.credits.InsufficientCreditsException;
import com.fiap.ford.specsync.domain.exceptions.DomainException;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The use cases against a hand-written wallet: no Spring, no Mockito, no database. */
class DefaultCreditsUseCasesTest {

    private final FakeCreditsGateway gateway = new FakeCreditsGateway();

    @Test
    void readsTheWalletTogetherWithTheRateCard() {
        final var output = new DefaultGetWallet(gateway).execute(new GetWallet.Input("abc"));

        assertEquals("abc", output.wallet().uid().value());
        assertEquals(Credits.SIGNUP_GRANT, output.wallet().balance());
        assertEquals(List.of(FakeCreditsGateway.FLASH), output.tariffs());
        assertFalse(output.wallet().exhausted());
    }

    @Test
    void trimsTheUidBeforeItReachesTheWallet() {
        new DefaultGetWallet(gateway).execute(new GetWallet.Input("  abc  "));

        assertEquals("abc", gateway.walletCalls().getFirst().value());
    }

    @Test
    void rejectsAWalletRequestWithoutAUid() {
        final var useCase = new DefaultGetWallet(gateway);
        assertThrows(DomainException.class, () -> useCase.execute(new GetWallet.Input(" ")));
    }

    @Test
    void listsTheActiveTariffs() {
        assertEquals(
                List.of(FakeCreditsGateway.FLASH),
                new DefaultListModelTariffs(gateway).execute().models());
    }

    @Test
    void admitsARunAndReportsItsHold() {
        final var output = new DefaultStartCreditRun(gateway)
                .execute(new StartCreditRun.Input("abc", "run-1", "vertex", "gemini-2.5-flash", "thread-1"));

        assertEquals("run-1", output.runId());
        assertEquals(FakeCreditsGateway.FLASH.holdCap(), output.hold());
        assertEquals(Credits.SIGNUP_GRANT, output.balance());
        assertEquals(Credits.SIGNUP_GRANT.minus(FakeCreditsGateway.FLASH.holdCap()), output.available());
        assertFalse(output.exhausted());
    }

    @Test
    void refusesToStartARunTheWalletCannotCover() {
        gateway.balance(CreditAmount.of(1_000));

        final var useCase = new DefaultStartCreditRun(gateway);
        final var input = new StartCreditRun.Input("abc", "run-1", "vertex", "gemini-2.5-flash", null);
        final var rejection = assertThrows(InsufficientCreditsException.class, () -> useCase.execute(input));

        assertEquals(CreditAmount.of(1_000), rejection.available());
        assertEquals(FakeCreditsGateway.FLASH.minimumCharge(), rejection.minimumCharge());
    }

    @Test
    void chargesAStepAtTheRateCardAndLowersTheBalance() {
        final var output = new DefaultRecordCreditUsage(gateway)
                .execute(new RecordCreditUsage.Input(
                        "abc", "run-1", "step-1", "vertex", "gemini-2.5-flash", 5_120, 0, 640, 200, false));

        final var expected = FakeCreditsGateway.FLASH.charge(5_120, 0, 640);
        assertEquals(expected, output.charge());
        assertEquals(Credits.SIGNUP_GRANT.minus(expected), output.balance());
        assertFalse(output.exhausted());
    }

    @Test
    void passesTheReportedTokensThroughUntouched() {
        new DefaultRecordCreditUsage(gateway)
                .execute(new RecordCreditUsage.Input(
                        "abc", "run-1", "step-1", "vertex", "gemini-2.5-flash", 8_000, 1_000, 2_000, 500, true));

        final var step = gateway.steps().get("step-1");
        assertEquals(8_000, step.inputTokens());
        assertEquals(1_000, step.cachedInputTokens());
        assertEquals(2_000, step.outputTokens());
        assertEquals(500, step.reasoningTokens());
        assertTrue(step.estimated());
    }

    @Test
    void reportsAnExhaustedWalletAfterTheStepThatUsesItUp() {
        gateway.balance(CreditAmount.of(1_000));

        final var output = new DefaultRecordCreditUsage(gateway)
                .execute(new RecordCreditUsage.Input(
                        "abc", "run-1", "step-1", "vertex", "gemini-2.5-flash", 4_000, 0, 1_000, 0, false));

        assertTrue(output.balance().isNegative());
        assertTrue(output.exhausted());
    }

    @Test
    void finishesARunAndAnswersWithTheRefreshedWallet() {
        gateway.holds(CreditAmount.of(145_000));

        final var output =
                new DefaultFinishCreditRun(gateway).execute(new FinishCreditRun.Input("abc", "run-1", "completed"));

        assertEquals(List.of("run-1:COMPLETED"), gateway.finished());
        assertEquals(CreditAmount.ZERO, output.wallet().holds());
        assertEquals(List.of(FakeCreditsGateway.FLASH), output.tariffs());
    }

    @Test
    void refusesToFinishARunWithAStatusThatIsNotTerminal() {
        final var useCase = new DefaultFinishCreditRun(gateway);
        final var input = new FinishCreditRun.Input("abc", "run-1", "OPEN");
        assertThrows(DomainException.class, () -> useCase.execute(input));
        assertEquals(List.of(), gateway.finished());
    }
}
