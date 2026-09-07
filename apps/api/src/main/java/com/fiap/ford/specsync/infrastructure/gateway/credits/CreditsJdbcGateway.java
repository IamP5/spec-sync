package com.fiap.ford.specsync.infrastructure.gateway.credits;

import com.fiap.ford.specsync.domain.credits.CreditAmount;
import com.fiap.ford.specsync.domain.credits.CreditRunClosedException;
import com.fiap.ford.specsync.domain.credits.CreditRunNotFoundException;
import com.fiap.ford.specsync.domain.credits.CreditRunOwnedByAnotherWalletException;
import com.fiap.ford.specsync.domain.credits.Credits;
import com.fiap.ford.specsync.domain.credits.CreditsGateway;
import com.fiap.ford.specsync.domain.credits.UnpricedModelException;
import com.fiap.ford.specsync.domain.credits.WalletId;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * The wallet on PostgreSQL (schema {@code credits}, migration {@code V7}).
 *
 * <p>Every mutation takes the wallet row with {@code SELECT … FOR UPDATE} first, so admission,
 * charging and finishing are serialised per user: two runs racing for the last credits cannot both
 * be admitted, and a replayed step cannot debit twice. Idempotency is expressed in the schema —
 * {@code entry_key} is unique, {@code (run_id, step_key)} is the step's primary key — and every
 * insert is {@code ON CONFLICT DO NOTHING} followed by a re-read, so a lost race still returns the
 * stored state.
 *
 * <p>"Now" is passed in as a parameter rather than read with {@code now()}: the value is stable
 * across the statements of one transaction and the SQL stays portable to the H2 database the
 * adapter's integration test uses.
 */
@Repository
public class CreditsJdbcGateway implements CreditsGateway {

    private final NamedParameterJdbcTemplate jdbc;

    public CreditsJdbcGateway(final DataSource dataSource) {
        this.jdbc = new NamedParameterJdbcTemplate(Objects.requireNonNull(dataSource));
    }

    // ------------------------------------------------------------------
    // Reads
    // ------------------------------------------------------------------

    @Override
    @Transactional
    public Credits.Wallet wallet(final WalletId uid) {
        ensureWallet(uid, Instant.now());
        return view(uid, Instant.now());
    }

    @Override
    @Transactional(readOnly = true)
    public List<Credits.ModelTariff> tariffs() {
        return jdbc.query(
                """
                SELECT provider, model_id, version, input_per_million, cached_input_per_million,
                       output_per_million, effective_from, active
                FROM credits.model_tariff WHERE active = TRUE ORDER BY provider, model_id
                """,
                Map.of(),
                (rs, index) -> new Credits.ModelTariff(
                        rs.getString("provider"),
                        rs.getString("model_id"),
                        rs.getInt("version"),
                        CreditAmount.of(rs.getLong("input_per_million")),
                        CreditAmount.of(rs.getLong("cached_input_per_million")),
                        CreditAmount.of(rs.getLong("output_per_million")),
                        instant(rs.getTimestamp("effective_from")),
                        rs.getBoolean("active")));
    }

    // ------------------------------------------------------------------
    // Run lifecycle
    // ------------------------------------------------------------------

    @Override
    @Transactional
    public Credits.Admission startRun(
            final WalletId uid,
            final String runId,
            final String provider,
            final String modelId,
            final String threadId) {
        Credits.require(runId != null && !runId.isBlank(), "runId", "A run id is required");
        final var now = Instant.now();
        final var id = runUuid(runId);
        ensureWallet(uid, now);
        lock(uid);

        final var existing = run(uid, id);
        if (existing.isPresent()) {
            // Idempotent replay: the run keeps the hold it was admitted with.
            final var wallet = view(uid, now);
            return new Credits.Admission(
                    runId, existing.get().hold(), wallet.balance(), wallet.available(), wallet.exhausted());
        }

        // The run id is a global key: another wallet holding it is a conflict, not a missing run.
        refuseForeignRun(uid, id, runId);

        final var active = tariffs();
        final var tariff = active.stream()
                .filter(candidate -> candidate.prices(provider, modelId))
                .findFirst()
                .orElseThrow(() -> new UnpricedModelException(provider, modelId));

        final var before = view(uid, now);
        Credits.admit(before.available(), tariff, active);
        final var hold = Credits.hold(before.available(), tariff);

        final var parameters = new HashMap<String, Object>();
        parameters.put("id", id);
        parameters.put("uid", uid.value());
        parameters.put("threadId", threadId);
        parameters.put("provider", tariff.provider());
        parameters.put("modelId", tariff.modelId());
        parameters.put("tariffVersion", tariff.version());
        parameters.put("hold", hold.micros());
        parameters.put("expiresAt", timestamp(now.plus(Credits.HOLD_TTL)));
        parameters.put("startedAt", timestamp(now));
        jdbc.update("""
                INSERT INTO credits.run
                    (id, uid, thread_id, provider, model_id, tariff_version, status, hold, hold_expires_at, charge, started_at)
                VALUES
                    (:id, :uid, :threadId, :provider, :modelId, :tariffVersion, 'OPEN', :hold, :expiresAt, 0, :startedAt)
                ON CONFLICT DO NOTHING
                """, parameters);

        final var admitted = run(uid, id).orElseGet(() -> {
            // A lost race can only mean the row was taken by another wallet in the meantime.
            refuseForeignRun(uid, id, runId);
            throw new CreditRunNotFoundException(runId);
        });
        final var after = view(uid, now);
        return new Credits.Admission(runId, admitted.hold(), after.balance(), after.available(), after.exhausted());
    }

    @Override
    @Transactional
    public Credits.Usage recordUsage(final WalletId uid, final String runId, final Credits.RunStep step) {
        Credits.require(runId != null && !runId.isBlank(), "runId", "A run id is required");
        final var now = Instant.now();
        final var id = runUuid(runId);
        lock(uid);

        final var run = run(uid, id).orElseThrow(() -> new CreditRunNotFoundException(runId));

        final var recorded = jdbc.query(
                "SELECT charge FROM credits.run_step WHERE run_id = :runId AND step_key = :stepKey",
                Map.of("runId", id, "stepKey", step.stepKey()),
                (rs, index) -> CreditAmount.of(rs.getLong("charge")));
        if (!recorded.isEmpty()) {
            // Replay: answer with the charge that was already posted, without touching the ledger.
            return usage(uid, recorded.getFirst(), now);
        }
        if (!run.status().isOpen()) {
            throw new CreditRunClosedException(runId, run.status());
        }

        final var tariff = tariffFor(step.provider(), step.modelId())
                .or(() -> tariffFor(run.provider(), run.modelId()))
                .orElseThrow(() -> new UnpricedModelException(
                        step.provider() == null ? run.provider() : step.provider(),
                        step.modelId() == null ? run.modelId() : step.modelId()));
        final var charge = tariff.charge(step.inputTokens(), step.cachedInputTokens(), step.outputTokens());

        final var stepParameters = new HashMap<String, Object>();
        stepParameters.put("runId", id);
        stepParameters.put("stepKey", step.stepKey());
        stepParameters.put("provider", tariff.provider());
        stepParameters.put("modelId", tariff.modelId());
        stepParameters.put("inputTokens", step.inputTokens());
        stepParameters.put("cachedInputTokens", step.cachedInputTokens());
        stepParameters.put("outputTokens", step.outputTokens());
        stepParameters.put("reasoningTokens", step.reasoningTokens());
        stepParameters.put("estimated", step.estimated());
        stepParameters.put("charge", charge.micros());
        stepParameters.put("createdAt", timestamp(now));
        final var inserted = jdbc.update("""
                INSERT INTO credits.run_step
                    (run_id, step_key, provider, model_id, input_tokens, cached_input_tokens, output_tokens,
                     reasoning_tokens, estimated, charge, created_at)
                VALUES
                    (:runId, :stepKey, :provider, :modelId, :inputTokens, :cachedInputTokens, :outputTokens,
                     :reasoningTokens, :estimated, :charge, :createdAt)
                ON CONFLICT DO NOTHING
                """, stepParameters);
        if (inserted == 0) {
            // Another writer won the race on the same step key; re-read its charge.
            return usage(uid, storedCharge(id, step.stepKey()), now);
        }

        if (charge.micros() == 0L) {
            // A step that prices at nothing (no reported tokens) is still recorded, so a replay is
            // answered from the stored row, but it moves no credits: the ledger forbids a zero amount
            // (V7: CHECK (amount <> 0)) and neither the hold nor the run's charge changes.
            return usage(uid, charge, now);
        }

        final var entry = new HashMap<String, Object>();
        entry.put("id", UUID.randomUUID());
        entry.put("uid", uid.value());
        entry.put("entryKey", "usage:%s:%s".formatted(id, step.stepKey()));
        entry.put("amount", -charge.micros());
        entry.put("runId", id);
        entry.put("description", "%s %s".formatted(tariff.provider(), tariff.modelId()));
        entry.put("createdAt", timestamp(now));
        jdbc.update("""
                INSERT INTO credits.ledger_entry (id, uid, entry_key, kind, amount, run_id, description, created_at)
                VALUES (:id, :uid, :entryKey, 'DEBIT', :amount, :runId, :description, :createdAt)
                ON CONFLICT DO NOTHING
                """, entry);

        // The hold shrinks by what was committed and never turns into a credit of its own.
        jdbc.update("""
                UPDATE credits.run
                SET hold = CASE WHEN hold > :charge THEN hold - :charge ELSE 0 END,
                    charge = charge + :charge,
                    tariff_version = :tariffVersion
                WHERE id = :runId
                """, Map.of("charge", charge.micros(), "tariffVersion", tariff.version(), "runId", id));

        return usage(uid, charge, now);
    }

    @Override
    @Transactional
    public Credits.Wallet finishRun(final WalletId uid, final String runId, final Credits.RunStatus status) {
        Credits.require(runId != null && !runId.isBlank(), "runId", "A run id is required");
        final var now = Instant.now();
        final var id = runUuid(runId);
        lock(uid);
        run(uid, id).orElseThrow(() -> new CreditRunNotFoundException(runId));

        // Only an open run is closed, which makes a replayed finish a no-op instead of a reopen.
        jdbc.update("""
                UPDATE credits.run
                SET status = :status, hold = 0, hold_expires_at = NULL, finished_at = :finishedAt
                WHERE id = :runId AND status = 'OPEN'
                """, Map.of("status", status.name(), "finishedAt", timestamp(now), "runId", id));
        return view(uid, now);
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    /** Creates the wallet and posts the one-off signup grant. Both inserts are idempotent. */
    private void ensureWallet(final WalletId uid, final Instant now) {
        jdbc.update(
                "INSERT INTO credits.wallet (uid, created_at) VALUES (:uid, :createdAt) ON CONFLICT DO NOTHING",
                Map.of("uid", uid.value(), "createdAt", timestamp(now)));
        final var grant = new HashMap<String, Object>();
        grant.put("id", UUID.randomUUID());
        grant.put("uid", uid.value());
        grant.put("entryKey", Credits.SIGNUP_GRANT_KEY_PREFIX + uid.value());
        grant.put("amount", Credits.SIGNUP_GRANT.micros());
        grant.put("createdAt", timestamp(now));
        jdbc.update("""
                INSERT INTO credits.ledger_entry (id, uid, entry_key, kind, amount, run_id, description, created_at)
                VALUES (:id, :uid, :entryKey, 'GRANT', :amount, NULL, 'Signup promotional grant', :createdAt)
                ON CONFLICT DO NOTHING
                """, grant);
    }

    /** Serialises everything that touches this wallet; every mutation calls it before it reads. */
    private void lock(final WalletId uid) {
        jdbc.query(
                "SELECT uid FROM credits.wallet WHERE uid = :uid FOR UPDATE",
                Map.of("uid", uid.value()),
                (rs, index) -> rs.getString("uid"));
    }

    private Credits.Wallet view(final WalletId uid, final Instant now) {
        final var totals = jdbc.queryForMap("""
                SELECT COALESCE(SUM(amount), 0) AS balance,
                       COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS granted,
                       COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS spent
                FROM credits.ledger_entry WHERE uid = :uid
                """, Map.of("uid", uid.value()));
        // Only unexpired holds of open runs reduce what may still be committed.
        final var holds = jdbc.queryForObject("""
                SELECT COALESCE(SUM(hold), 0) FROM credits.run
                WHERE uid = :uid AND status = 'OPEN' AND hold_expires_at > :now
                """, Map.of("uid", uid.value(), "now", timestamp(now)), Long.class);
        final var recent = jdbc.query(
                """
                SELECT id, thread_id, provider, model_id, tariff_version, status, hold, hold_expires_at,
                       charge, started_at, finished_at
                FROM credits.run WHERE uid = :uid ORDER BY started_at DESC, id DESC LIMIT :limit
                """, Map.of("uid", uid.value(), "limit", Credits.RECENT_RUNS), (rs, index) -> readRun(rs, uid));
        return new Credits.Wallet(
                uid,
                CreditAmount.of(number(totals.get("balance"))),
                CreditAmount.of(holds == null ? 0L : holds),
                CreditAmount.of(number(totals.get("granted"))),
                CreditAmount.of(number(totals.get("spent"))),
                recent);
    }

    private Credits.Usage usage(final WalletId uid, final CreditAmount charge, final Instant now) {
        final var wallet = view(uid, now);
        return new Credits.Usage(charge, wallet.balance(), wallet.available(), wallet.exhausted());
    }

    private CreditAmount storedCharge(final UUID id, final String stepKey) {
        final var charge = jdbc.queryForObject(
                "SELECT charge FROM credits.run_step WHERE run_id = :runId AND step_key = :stepKey",
                Map.of("runId", id, "stepKey", stepKey),
                Long.class);
        return CreditAmount.of(charge == null ? 0L : charge);
    }

    private Optional<Credits.ModelTariff> tariffFor(final String provider, final String modelId) {
        if (provider == null || modelId == null) {
            return Optional.empty();
        }
        return tariffs().stream()
                .filter(candidate -> candidate.prices(provider, modelId))
                .findFirst();
    }

    /**
     * Refuses a run id that another wallet already owns. Run ids are global keys, so a replay under
     * a foreign wallet is a conflict; without this it would look like a run this wallet never
     * started and answer 404 instead of 409.
     */
    private void refuseForeignRun(final WalletId uid, final UUID id, final String runId) {
        final var owner = jdbc
                .query(
                        "SELECT uid FROM credits.run WHERE id = :id",
                        Map.of("id", id),
                        (rs, index) -> rs.getString("uid"))
                .stream()
                .findFirst();
        if (owner.isPresent() && !owner.get().equals(uid.value())) {
            throw new CreditRunOwnedByAnotherWalletException(runId);
        }
    }

    private Optional<Credits.CreditRun> run(final WalletId uid, final UUID id) {
        return jdbc.query("""
                        SELECT id, thread_id, provider, model_id, tariff_version, status, hold, hold_expires_at,
                               charge, started_at, finished_at
                        FROM credits.run WHERE id = :id AND uid = :uid
                        """, Map.of("id", id, "uid", uid.value()), (rs, index) -> readRun(rs, uid)).stream()
                .findFirst();
    }

    private static Credits.CreditRun readRun(final java.sql.ResultSet rs, final WalletId uid)
            throws java.sql.SQLException {
        final var version = rs.getInt("tariff_version");
        final Integer tariffVersion = rs.wasNull() ? null : version;
        return new Credits.CreditRun(
                rs.getString("id"),
                uid,
                rs.getString("thread_id"),
                rs.getString("provider"),
                rs.getString("model_id"),
                tariffVersion,
                Credits.RunStatus.of(rs.getString("status")),
                CreditAmount.of(rs.getLong("hold")),
                instant(rs.getTimestamp("hold_expires_at")),
                CreditAmount.of(rs.getLong("charge")),
                instant(rs.getTimestamp("started_at")),
                instant(rs.getTimestamp("finished_at")));
    }

    /**
     * The database keys runs by UUID while the AI service sends the AG-UI run id, which is a UUID in
     * practice but is not guaranteed to be one. Any other value is folded into a stable name-based
     * UUID, so idempotency per run id holds either way.
     */
    static UUID runUuid(final String runId) {
        try {
            return UUID.fromString(runId.trim());
        } catch (IllegalArgumentException notAUuid) {
            return UUID.nameUUIDFromBytes(("specsync-credits-run:" + runId.trim()).getBytes(StandardCharsets.UTF_8));
        }
    }

    private static long number(final Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }

    private static Instant instant(final Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private static Timestamp timestamp(final Instant value) {
        return Timestamp.from(value);
    }
}
