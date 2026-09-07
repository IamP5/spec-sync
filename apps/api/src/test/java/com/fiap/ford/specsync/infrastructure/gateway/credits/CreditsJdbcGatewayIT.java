package com.fiap.ford.specsync.infrastructure.gateway.credits;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fiap.ford.specsync.domain.credits.CreditAmount;
import com.fiap.ford.specsync.domain.credits.CreditRunClosedException;
import com.fiap.ford.specsync.domain.credits.CreditRunNotFoundException;
import com.fiap.ford.specsync.domain.credits.CreditRunOwnedByAnotherWalletException;
import com.fiap.ford.specsync.domain.credits.Credits;
import com.fiap.ford.specsync.domain.credits.InsufficientCreditsException;
import com.fiap.ford.specsync.domain.credits.UnpricedModelException;
import com.fiap.ford.specsync.domain.credits.WalletId;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/**
 * Exercises the real JDBC adapter against H2 in PostgreSQL mode with a hand-written copy of the V7
 * schema (Flyway is disabled in tests, see {@code src/test/resources/application.properties}).
 *
 * <p>Two production details cannot be expressed in H2 and are therefore left out of the test DDL:
 * the partial unique index on the active tariff and the plpgsql append-only trigger on the ledger.
 * Neither changes what the adapter does; both are covered by the migration itself.
 */
class CreditsJdbcGatewayIT {

    private static final WalletId UID = new WalletId("user-abc");
    private static final CreditAmount FLASH_MINIMUM = CreditAmount.of(18_500);
    private static final CreditAmount FLASH_HOLD_CAP = CreditAmount.of(145_000);

    private CreditsJdbcGateway gateway;
    private JdbcTemplate jdbc;

    @BeforeEach
    void createSchema() {
        final var source = new DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(source);
        jdbc.execute("CREATE SCHEMA credits");
        jdbc.execute("CREATE TABLE credits.wallet (uid varchar PRIMARY KEY, created_at timestamp with time zone)");
        jdbc.execute("""
                CREATE TABLE credits.model_tariff (
                 id uuid PRIMARY KEY, provider varchar NOT NULL, model_id varchar NOT NULL, version int NOT NULL,
                 input_per_million bigint NOT NULL, cached_input_per_million bigint NOT NULL,
                 output_per_million bigint NOT NULL, effective_from timestamp with time zone,
                 active boolean NOT NULL, UNIQUE (provider, model_id, version))
                """);
        jdbc.execute("""
                CREATE TABLE credits.run (
                 id uuid PRIMARY KEY, uid varchar NOT NULL REFERENCES credits.wallet (uid), thread_id varchar,
                 provider varchar NOT NULL, model_id varchar NOT NULL, tariff_version int,
                 status varchar NOT NULL, hold bigint NOT NULL DEFAULT 0, hold_expires_at timestamp with time zone,
                 charge bigint NOT NULL DEFAULT 0, started_at timestamp with time zone NOT NULL,
                 finished_at timestamp with time zone)
                """);
        jdbc.execute("""
                CREATE TABLE credits.ledger_entry (
                 id uuid PRIMARY KEY, uid varchar NOT NULL REFERENCES credits.wallet (uid),
                 entry_key varchar NOT NULL UNIQUE, kind varchar NOT NULL,
                 amount bigint NOT NULL CHECK (amount <> 0),
                 run_id uuid, description varchar, created_at timestamp with time zone)
                """);
        jdbc.execute("""
                CREATE TABLE credits.run_step (
                 run_id uuid NOT NULL REFERENCES credits.run (id), step_key varchar NOT NULL,
                 provider varchar NOT NULL, model_id varchar NOT NULL, input_tokens bigint NOT NULL,
                 cached_input_tokens bigint NOT NULL, output_tokens bigint NOT NULL, reasoning_tokens bigint NOT NULL,
                 estimated boolean NOT NULL, charge bigint NOT NULL, created_at timestamp with time zone,
                 PRIMARY KEY (run_id, step_key))
                """);
        seedTariff("gemini-2.5-flash", 1_500_000, 375_000, 12_500_000);
        seedTariff("gemini-2.5-flash-lite", 500_000, 125_000, 2_000_000);
        seedTariff("gemini-2.5-pro", 6_250_000, 1_562_500, 50_000_000);
        gateway = new CreditsJdbcGateway(source);
    }

    @AfterEach
    void closeDatabase() {
        if (jdbc != null) {
            jdbc.execute("SHUTDOWN");
        }
    }

    private void seedTariff(final String modelId, final long input, final long cached, final long output) {
        jdbc.update(
                """
                INSERT INTO credits.model_tariff
                    (id, provider, model_id, version, input_per_million, cached_input_per_million,
                     output_per_million, effective_from, active)
                VALUES (?, 'vertex', ?, 1, ?, ?, ?, ?, TRUE)
                """,
                UUID.randomUUID(),
                modelId,
                input,
                cached,
                output,
                Timestamp.from(Instant.parse("2026-09-07T00:00:00Z")));
    }

    private long ledgerEntries(final String kind) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM credits.ledger_entry WHERE uid = ? AND kind = ?", Long.class, UID.value(), kind);
    }

    /** Drains the wallet down to the requested balance with a direct adjustment entry. */
    private void leaveOnly(final CreditAmount target) {
        final var balance = gateway.wallet(UID).balance();
        jdbc.update(
                """
                INSERT INTO credits.ledger_entry (id, uid, entry_key, kind, amount, description, created_at)
                VALUES (?, ?, ?, 'ADJUSTMENT', ?, 'test drain', ?)
                """,
                UUID.randomUUID(),
                UID.value(),
                "test:drain:" + UUID.randomUUID(),
                target.minus(balance).micros(),
                Timestamp.from(Instant.now()));
    }

    // ------------------------------------------------------------------

    @Test
    void grantsTheSignupCreditsOnceHoweverOftenTheWalletIsTouched() {
        final var first = gateway.wallet(UID);
        final var second = gateway.wallet(UID);

        assertEquals(Credits.SIGNUP_GRANT, first.balance());
        assertEquals(Credits.SIGNUP_GRANT, second.balance());
        assertEquals(Credits.SIGNUP_GRANT, second.granted());
        assertEquals(CreditAmount.ZERO, second.spent());
        assertEquals(1, ledgerEntries("GRANT"));
        assertEquals(
                1L,
                (long) jdbc.queryForObject("SELECT count(*) FROM credits.wallet", Long.class),
                "the wallet row is created once");
        assertFalse(second.exhausted());
    }

    @Test
    void listsOnlyActiveTariffs() {
        jdbc.update("UPDATE credits.model_tariff SET active = FALSE WHERE model_id = 'gemini-2.5-pro'");

        assertEquals(
                List.of("gemini-2.5-flash", "gemini-2.5-flash-lite"),
                gateway.tariffs().stream().map(Credits.ModelTariff::modelId).toList());
    }

    @Test
    void admitsARunAndHoldsOneRunsWorthOfCredits() {
        final var admission = gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");

        assertEquals(FLASH_HOLD_CAP, admission.hold());
        assertEquals(Credits.SIGNUP_GRANT, admission.balance());
        assertEquals(Credits.SIGNUP_GRANT.minus(FLASH_HOLD_CAP), admission.available());
        assertFalse(admission.exhausted());
    }

    @Test
    void returnsTheExistingRunWhenAdmissionIsReplayed() {
        final var first = gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");
        final var replay = gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");

        assertEquals(first.hold(), replay.hold());
        assertEquals(first.available(), replay.available());
        assertEquals(1L, (long) jdbc.queryForObject("SELECT count(*) FROM credits.run", Long.class));
    }

    @Test
    void refusesToStartARunWhenLessIsLeftThanAMinimumAnswerCosts() {
        leaveOnly(FLASH_MINIMUM.minus(CreditAmount.of(1)));

        final var rejection = assertThrows(
                InsufficientCreditsException.class,
                () -> gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", null));

        assertEquals(FLASH_MINIMUM.minus(CreditAmount.of(1)), rejection.available());
        assertEquals(FLASH_MINIMUM, rejection.minimumCharge());
        // The lite model still fits at that balance and is offered instead.
        assertEquals(List.of("gemini-2.5-flash-lite"), rejection.cheaperModels());
        assertEquals(0L, (long) jdbc.queryForObject("SELECT count(*) FROM credits.run", Long.class));
    }

    @Test
    void refusesToStartARunOnAModelWithoutAnActiveTariff() {
        assertThrows(
                UnpricedModelException.class, () -> gateway.startRun(UID, "run-1", "vertex", "gemini-3-pro", null));
    }

    @Test
    void chargesAStepAndShrinksTheRunsHold() {
        gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");

        final var usage = gateway.recordUsage(UID, "run-1", step("step-1", 5_120, 0, 640));

        final var expected = CreditAmount.of(7_680 + 8_000);
        assertEquals(expected, usage.charge());
        assertEquals(Credits.SIGNUP_GRANT.minus(expected), usage.balance());
        assertEquals(FLASH_HOLD_CAP.minus(expected), hold("run-1"));
        assertEquals(1, ledgerEntries("DEBIT"));
        assertEquals(expected.micros(), runCharge("run-1"));
    }

    @Test
    void replaysAStepWithoutChargingItTwice() {
        gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");
        final var first = gateway.recordUsage(UID, "run-1", step("step-1", 5_120, 0, 640));
        final var replay = gateway.recordUsage(UID, "run-1", step("step-1", 5_120, 0, 640));

        assertEquals(first.charge(), replay.charge());
        assertEquals(first.balance(), replay.balance());
        assertEquals(1, ledgerEntries("DEBIT"));
        assertEquals(1L, (long) jdbc.queryForObject("SELECT count(*) FROM credits.run_step", Long.class));
    }

    @Test
    void chargesEveryDistinctStepOfTheSameRun() {
        gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");
        gateway.recordUsage(UID, "run-1", step("step-1", 4_000, 0, 1_000));
        final var second = gateway.recordUsage(UID, "run-1", step("step-2", 4_000, 0, 1_000));

        assertEquals(Credits.SIGNUP_GRANT.minus(FLASH_MINIMUM).minus(FLASH_MINIMUM), second.balance());
        assertEquals(2, ledgerEntries("DEBIT"));
    }

    @Test
    void neverTurnsAHoldIntoACreditWhenAStepCostsMoreThanItReserved() {
        gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");

        gateway.recordUsage(UID, "run-1", step("step-1", 1_000_000, 0, 1_000_000));

        assertEquals(CreditAmount.ZERO, hold("run-1"));
    }

    @Test
    void refusesToChargeAStepOfAnUnknownRun() {
        gateway.wallet(UID);

        assertThrows(
                CreditRunNotFoundException.class,
                () -> gateway.recordUsage(UID, UUID.randomUUID().toString(), step("step-1", 10, 0, 10)));
    }

    @Test
    void refusesToChargeAStepOfAFinishedRun() {
        gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");
        gateway.finishRun(UID, "run-1", Credits.RunStatus.COMPLETED);

        assertThrows(
                CreditRunClosedException.class,
                () -> gateway.recordUsage(UID, "run-1", step("step-1", 4_000, 0, 1_000)));
    }

    @Test
    void releasesTheHoldWhenARunFinishes() {
        gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");
        gateway.recordUsage(UID, "run-1", step("step-1", 4_000, 0, 1_000));

        final var wallet = gateway.finishRun(UID, "run-1", Credits.RunStatus.COMPLETED);

        assertEquals(CreditAmount.ZERO, wallet.holds());
        assertEquals(Credits.SIGNUP_GRANT.minus(FLASH_MINIMUM), wallet.available());
        assertEquals(CreditAmount.ZERO, hold("run-1"));
        assertEquals(Credits.RunStatus.COMPLETED, wallet.recentRuns().getFirst().status());
        assertEquals(FLASH_MINIMUM, wallet.recentRuns().getFirst().charge());
    }

    @Test
    void keepsTheFirstOutcomeWhenAFinishIsReplayed() {
        gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");
        gateway.finishRun(UID, "run-1", Credits.RunStatus.EXHAUSTED);

        final var replay = gateway.finishRun(UID, "run-1", Credits.RunStatus.COMPLETED);

        assertEquals(Credits.RunStatus.EXHAUSTED, replay.recentRuns().getFirst().status());
        assertEquals(CreditAmount.ZERO, replay.holds());
    }

    @Test
    void stopsCountingAHoldOnceItExpired() {
        gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");
        assertEquals(
                Credits.SIGNUP_GRANT.minus(FLASH_HOLD_CAP), gateway.wallet(UID).available());

        jdbc.update(
                "UPDATE credits.run SET hold_expires_at = ? WHERE uid = ?",
                Timestamp.from(Instant.now().minus(1, ChronoUnit.MINUTES)),
                UID.value());

        final var wallet = gateway.wallet(UID);
        assertEquals(CreditAmount.ZERO, wallet.holds());
        assertEquals(Credits.SIGNUP_GRANT, wallet.available());
    }

    @Test
    @Timeout(30)
    void admitsTheSecondRunOnlyWithinWhatTheFirstHoldLeaves() {
        leaveOnly(CreditAmount.of(160_000));

        final var first = gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", null);
        assertEquals(CreditAmount.of(145_000), first.hold());

        // Only 15_000 is left, which no longer covers a minimum answer on flash (18_500).
        final var rejection = assertThrows(
                InsufficientCreditsException.class,
                () -> gateway.startRun(UID, "run-2", "vertex", "gemini-2.5-flash", null));
        assertEquals(CreditAmount.of(15_000), rejection.available());
        assertTrue(rejection.cheaperModels().contains("gemini-2.5-flash-lite"));
    }

    @Test
    void keepsAnyRunIdIdempotentEvenWhenItIsNotAUuid() {
        assertEquals(
                CreditsJdbcGateway.runUuid("agui-run-42"),
                CreditsJdbcGateway.runUuid(" agui-run-42 "),
                "a non-UUID run id folds into a stable name-based UUID");
        final var uuid = UUID.randomUUID();
        assertEquals(uuid, CreditsJdbcGateway.runUuid(uuid.toString()));
    }

    @Test
    void recordsAStepThatPricesAtNothingWithoutPostingALedgerEntry() {
        gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");

        final var usage = gateway.recordUsage(UID, "run-1", step("step-1", 0, 0, 0));

        // A zero amount is rejected by the ledger, so the step is recorded and nothing moves.
        assertEquals(CreditAmount.ZERO, usage.charge());
        assertEquals(Credits.SIGNUP_GRANT, usage.balance());
        assertEquals(0, ledgerEntries("DEBIT"));
        assertEquals(FLASH_HOLD_CAP, hold("run-1"));
        assertEquals(0L, runCharge("run-1"));
        assertEquals(1L, (long) jdbc.queryForObject("SELECT count(*) FROM credits.run_step", Long.class));
    }

    @Test
    void replaysAStepThatPricesAtNothing() {
        gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");
        final var first = gateway.recordUsage(UID, "run-1", step("step-1", 0, 0, 0));

        final var replay = gateway.recordUsage(UID, "run-1", step("step-1", 0, 0, 0));

        assertEquals(first.charge(), replay.charge());
        assertEquals(first.balance(), replay.balance());
        assertEquals(0, ledgerEntries("DEBIT"));
        assertEquals(1L, (long) jdbc.queryForObject("SELECT count(*) FROM credits.run_step", Long.class));
    }

    @Test
    void refusesToStartARunUnderARunIdAnotherWalletAlreadyOwns() {
        gateway.startRun(UID, "run-1", "vertex", "gemini-2.5-flash", "thread-1");

        // A run id is a global key: the second wallet gets a conflict, not "no such run".
        assertThrows(
                CreditRunOwnedByAnotherWalletException.class,
                () -> gateway.startRun(new WalletId("user-xyz"), "run-1", "vertex", "gemini-2.5-flash", null));
        assertEquals(1L, (long) jdbc.queryForObject("SELECT count(*) FROM credits.run", Long.class));
    }

    private static Credits.RunStep step(final String key, final long input, final long cached, final long output) {
        return new Credits.RunStep(
                key, "vertex", "gemini-2.5-flash", input, cached, output, 0, false, CreditAmount.ZERO, null);
    }

    private CreditAmount hold(final String runId) {
        return CreditAmount.of(jdbc.queryForObject(
                "SELECT hold FROM credits.run WHERE id = ?", Long.class, CreditsJdbcGateway.runUuid(runId)));
    }

    private long runCharge(final String runId) {
        return jdbc.queryForObject(
                "SELECT charge FROM credits.run WHERE id = ?", Long.class, CreditsJdbcGateway.runUuid(runId));
    }
}
