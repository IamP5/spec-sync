package com.fiap.ford.specsync.infrastructure.gateway.research;

import static com.fiap.ford.specsync.domain.research.Research.require;

import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import com.fiap.ford.specsync.domain.ontology.*;
import com.fiap.ford.specsync.domain.research.*;
import com.fiap.ford.specsync.infrastructure.configuration.IngestionProperties;
import com.fiap.ford.specsync.infrastructure.configuration.ResearchProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** PostgreSQL locks are the only create/join and attempt authority, across every API instance. */
@Repository
public class ResearchJdbcGateway implements ResearchGateway {
    private final NamedParameterJdbcTemplate jdbc;
    private final ResearchProperties properties;
    private final IngestionProperties ingestion;
    private final OntologyGateway ontology;
    private final JsonMapper json = JsonMapper.builder().build();

    public ResearchJdbcGateway(
            DataSource source, ResearchProperties properties, IngestionProperties ingestion, OntologyGateway ontology) {
        this.ontology = Objects.requireNonNull(ontology);
        jdbc = new NamedParameterJdbcTemplate(Objects.requireNonNull(source));
        this.properties = Objects.requireNonNull(properties);
        this.ingestion = Objects.requireNonNull(ingestion);
    }

    private String encode(Object value) {
        return json.writeValueAsString(value);
    }

    private <T> T decode(Object value, Class<T> type) {
        return json.readValue(value.toString(), type);
    }

    private static String hash(String value) {
        try {
            return HexFormat.of()
                    .formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private Map<String, Object> request(UUID id, String uid, boolean lock) {
        Research.requireIdentity(id, uid);
        var rows = jdbc.queryForList(
                "SELECT * FROM research.request WHERE id=:id AND user_id=:uid" + (lock ? " FOR UPDATE" : ""),
                Map.of("id", id, "uid", uid));
        require(!rows.isEmpty(), "Research request not found");
        return rows.getFirst();
    }

    @Override
    @Transactional
    public Research.Snapshot create(UUID id, String uid, Ingestion.Request input) {
        Research.requireIdentity(id, uid);
        require(
                ingestion.enabled()
                        && ingestion.workerKey() != null
                        && ingestion.workerKey().length() >= 32
                        && ingestion.workerUrl() != null
                        && !ingestion.workerUrl().isBlank(),
                "Research worker is not configured");
        var context = ontology.context();
        var scope = Research.Scope.of(input, properties.policyVersion());
        String scopeJson = encode(scope);
        String key = hash(scopeJson + ":" + context.ontologyRevision() + ":" + context.normalizationRevision());
        jdbc.update(
                "INSERT INTO research.request(user_id,id,request) VALUES(:uid,:id,CAST(:request AS jsonb)) ON CONFLICT DO NOTHING",
                Map.of("uid", uid, "id", id, "request", encode(input)));
        var saved = request(id, uid, true);
        require(
                decode(saved.get("request"), Ingestion.Request.class).equals(input),
                "Request ID already belongs to different research");
        if (saved.get("work_id") != null) return get(id, uid);

        jdbc.update(
                "INSERT INTO research.scope(scope_key,identity) VALUES(:key,CAST(:identity AS jsonb)) ON CONFLICT DO NOTHING",
                Map.of("key", key, "identity", scopeJson));
        var head = jdbc.queryForMap("SELECT * FROM research.scope WHERE scope_key=:key FOR UPDATE", Map.of("key", key));
        require(decode(head.get("identity"), Research.Scope.class).equals(scope), "Research scope collision");
        UUID workId = (UUID) head.get("current_work_id");
        String disposition = "CREATED";
        if (workId != null) {
            var run = jdbc.queryForMap(
                    "SELECT status,updated_at>now()-interval '24 hours' AS fresh FROM ingestion.run WHERE id=:id FOR UPDATE",
                    Map.of("id", workId));
            String status = run.get("status").toString();
            if (Set.of("QUEUED", "PROCESSING", "REVIEW").contains(status)) disposition = "JOINED";
            else if ("PUBLISHED".equals(status) && Boolean.TRUE.equals(run.get("fresh"))) disposition = "REUSED";
            else workId = null;
        }
        if (workId == null) {
            workId = UUID.randomUUID();
            var shared = new Ingestion.Request(
                    scope.sourceUrl(),
                    input.brand().strip().replaceAll("\\s+", " "),
                    input.model().strip().replaceAll("\\s+", " "),
                    input.market(),
                    input.modelYear(),
                    List.of());
            jdbc.update(
                    "INSERT INTO ingestion.run(id,owner_name,request,status,ontology_context) VALUES(:id,'curator',CAST(:request AS jsonb),'QUEUED',CAST(:context AS jsonb))",
                    Map.of("id", workId, "request", encode(shared), "context", encode(context)));
            jdbc.update(
                    "INSERT INTO research.work(run_id,scope_key,policy_version) VALUES(:id,:key,:policy)",
                    Map.of("id", workId, "key", key, "policy", scope.policyVersion()));
            jdbc.update(
                    "UPDATE research.scope SET current_work_id=:id WHERE scope_key=:key",
                    Map.of("id", workId, "key", key));
        }
        jdbc.update(
                "UPDATE research.request SET work_id=:work,disposition=:disposition,updated_at=now() WHERE id=:id AND user_id=:uid",
                Map.of("id", id, "uid", uid, "work", workId, "disposition", disposition));
        return get(id, uid);
    }

    @Override
    @Transactional(readOnly = true)
    public Research.Snapshot get(UUID id, String uid) {
        var saved = request(id, uid, false);
        UUID workId = (UUID) saved.get("work_id");
        var run = jdbc.queryForMap("""
                SELECT r.*, (SELECT key FROM research.checkpoint WHERE work_id=r.id ORDER BY sequence DESC LIMIT 1) AS checkpoint,
                greatest(r.updated_at, (SELECT max(created_at) FROM research.checkpoint WHERE work_id=r.id)) AS progress_at
                FROM ingestion.run r WHERE r.id=:id
                """, Map.of("id", workId));
        Ingestion.Draft draft = run.get("draft") == null ? null : decode(run.get("draft"), Ingestion.Draft.class);
        String status = run.get("status").toString();
        String stage = "PROCESSING".equals(status) && run.get("checkpoint") != null
                ? run.get("checkpoint").toString()
                : status.toLowerCase(Locale.ROOT);
        Map<String, UUID> ids = run.get("configuration_ids") == null
                ? Map.of()
                : json.readValue(run.get("configuration_ids").toString(), new TypeReference<Map<String, UUID>>() {});
        Instant updated = ((Timestamp) saved.get("updated_at")).toInstant();
        Instant progress = ((Timestamp) run.get("progress_at")).toInstant();
        var context = run.get("ontology_context") == null
                ? null
                : decode(run.get("ontology_context"), Ontology.Context.class);
        UUID replayedFrom = jdbc.queryForObject(
                "SELECT replayed_from_work_id FROM research.work WHERE run_id=:id", Map.of("id", workId), UUID.class);
        return new Research.Snapshot(
                id,
                workId,
                saved.get("status").toString(),
                saved.get("disposition").toString(),
                decode(saved.get("request"), Ingestion.Request.class),
                status,
                ((Number) run.get("attempts")).intValue(),
                stage,
                draft == null ? List.of() : draft.configurations(),
                draft == null ? List.of() : draft.warnings(),
                (String) run.get("error"),
                draft == null ? null : Research.Source.from(draft.source()),
                ids,
                ((Timestamp) saved.get("created_at")).toInstant(),
                updated.isAfter(progress) ? updated : progress,
                context == null ? 0 : context.ontologyRevision(),
                context == null ? null : context.normalizationRevision(),
                replayedFrom);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Research.Summary> list(String uid) {
        Research.requireIdentity(new UUID(0, 0), uid);
        return jdbc.query(
                """
                SELECT q.id,q.work_id,q.status AS request_status,q.disposition,q.request,
                       r.status,r.attempts,
                       CASE WHEN r.status='PROCESSING' AND c.key IS NOT NULL THEN c.key
                            ELSE lower(r.status) END AS stage,
                       q.created_at,greatest(q.updated_at,r.updated_at,c.created_at) AS updated_at
                FROM research.request q JOIN ingestion.run r ON r.id=q.work_id
                LEFT JOIN LATERAL (
                    SELECT key,created_at FROM research.checkpoint WHERE work_id=r.id
                    ORDER BY sequence DESC LIMIT 1
                ) c ON true
                WHERE q.user_id=:uid ORDER BY q.created_at DESC LIMIT 100
                """,
                Map.of("uid", uid),
                (rs, index) -> new Research.Summary(
                        (UUID) rs.getObject("id"),
                        (UUID) rs.getObject("work_id"),
                        rs.getString("request_status"),
                        rs.getString("disposition"),
                        decode(rs.getObject("request"), Ingestion.Request.class),
                        rs.getString("status"),
                        rs.getInt("attempts"),
                        rs.getString("stage"),
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("updated_at").toInstant()));
    }

    @Override
    @Transactional
    public Research.Snapshot cancel(UUID id, String uid) {
        request(id, uid, true);
        jdbc.update(
                "UPDATE research.request SET status='CANCELLED',updated_at=now() WHERE id=:id AND user_id=:uid AND status='ACTIVE'",
                Map.of("id", id, "uid", uid));
        return get(id, uid);
    }

    @Override
    @Transactional
    public Research.Snapshot replay(UUID id, String uid, UUID newId) {
        Research.requireIdentity(newId, uid);
        require(!id.equals(newId), "A replay needs a new private request ID");
        var context = ontology.context();
        var original = request(id, uid, false);
        UUID originalWork = (UUID) original.get("work_id");
        var completed = jdbc.queryForMap("SELECT status FROM ingestion.run WHERE id=:id", Map.of("id", originalWork));
        require(
                Set.of("REVIEW", "PUBLISHED").contains(completed.get("status")),
                "Only completed source research can be reinterpreted");
        var input = decode(original.get("request"), Ingestion.Request.class);
        jdbc.update(
                "INSERT INTO research.request(user_id,id,request) VALUES(:uid,:id,CAST(:request AS jsonb)) ON CONFLICT DO NOTHING",
                Map.of("uid", uid, "id", newId, "request", encode(input)));
        var saved = request(newId, uid, true);
        require(
                decode(saved.get("request"), Ingestion.Request.class).equals(input),
                "Replay request ID already belongs to different research");
        if (saved.get("work_id") != null) {
            var result = get(newId, uid);
            require(
                    originalWork.equals(result.replayedFromWorkId()),
                    "Replay request ID already belongs to another source interpretation");
            return result;
        }
        var captures = jdbc.queryForList(
                "SELECT key,payload FROM research.checkpoint WHERE work_id=:id AND key IN ('capture-source','identify-configurations') ORDER BY sequence",
                Map.of("id", originalWork));
        require(captures.size() == 2, "Replay requires retained capture and configuration identification checkpoints");
        var source = jdbc.queryForMap(
                "SELECT original_sha256,text_sha256,parser_version FROM ingestion.source_capture WHERE run_id=:id",
                Map.of("id", originalWork));
        String policyVersion = properties.policyVersion();
        var identity = Map.of(
                "policyVersion",
                policyVersion,
                "replayedFromWorkId",
                originalWork,
                "originalSha256",
                source.get("original_sha256"),
                "textSha256",
                source.get("text_sha256"),
                "readerRevision",
                source.get("parser_version"),
                "ontologyRevision",
                context.ontologyRevision(),
                "normalizationRevision",
                context.normalizationRevision());
        String identityJson = encode(identity);
        String key = hash("replay:" + originalWork + ":" + context.ontologyRevision() + ":"
                + context.normalizationRevision() + ":" + source.get("parser_version") + ":" + policyVersion);
        jdbc.update(
                "INSERT INTO research.scope(scope_key,identity) VALUES(:key,CAST(:identity AS jsonb)) ON CONFLICT DO NOTHING",
                Map.of("key", key, "identity", identityJson));
        var head = jdbc.queryForMap("SELECT * FROM research.scope WHERE scope_key=:key FOR UPDATE", Map.of("key", key));
        require(
                json.readTree(head.get("identity").toString()).equals(json.readTree(identityJson)),
                "Replay scope collision");
        UUID workId = (UUID) head.get("current_work_id");
        String disposition = "CREATED";
        if (workId != null) {
            String status = jdbc.queryForObject(
                    "SELECT status FROM ingestion.run WHERE id=:id FOR UPDATE", Map.of("id", workId), String.class);
            if (Set.of("QUEUED", "PROCESSING", "REVIEW").contains(status)) disposition = "JOINED";
            else if ("PUBLISHED".equals(status)) disposition = "REUSED";
            else workId = null;
        }
        if (workId == null) {
            workId = UUID.randomUUID();
            var shared = new Ingestion.Request(
                    input.sourceUrl(), input.brand(), input.model(), input.market(), input.modelYear(), List.of());
            jdbc.update(
                    "INSERT INTO ingestion.run(id,owner_name,request,status,ontology_context) VALUES(:id,'curator',CAST(:request AS jsonb),'QUEUED',CAST(:context AS jsonb))",
                    Map.of("id", workId, "request", encode(shared), "context", encode(context)));
            jdbc.update(
                    "INSERT INTO research.work(run_id,scope_key,policy_version,replayed_from_work_id) VALUES(:id,:key,:policy,:from)",
                    Map.of("id", workId, "key", key, "policy", policyVersion, "from", originalWork));
            jdbc.update(
                    "UPDATE research.scope SET current_work_id=:id WHERE scope_key=:key",
                    Map.of("id", workId, "key", key));
            for (var checkpoint : captures)
                jdbc.update(
                        "INSERT INTO research.checkpoint(work_id,key,payload) VALUES(:id,:key,:payload)",
                        Map.of("id", workId, "key", checkpoint.get("key"), "payload", checkpoint.get("payload")));
        }
        jdbc.update(
                "UPDATE research.request SET work_id=:work,disposition=:disposition,updated_at=now() WHERE id=:id AND user_id=:uid",
                Map.of("id", newId, "uid", uid, "work", workId, "disposition", disposition));
        return get(newId, uid);
    }

    private Map<String, Object> lease(UUID workId, UUID attemptId) {
        require(workId != null && attemptId != null, "A processing attempt is required");
        var params = Map.<String, Object>of("id", workId, "token", attemptId);
        var rows = jdbc.queryForList("""
                SELECT r.id FROM ingestion.run r JOIN research.work w ON w.run_id=r.id
                WHERE r.id=:id FOR UPDATE OF r
                """, params);
        require(!rows.isEmpty(), "Expired processing attempt");
        // Recheck after acquiring the lock: the lease may expire while a previous holder blocks us.
        Boolean current = jdbc.queryForObject(
                "SELECT lease_token=:token AND status='PROCESSING' AND lease_until>clock_timestamp() FROM ingestion.run WHERE id=:id",
                params,
                Boolean.class);
        require(Boolean.TRUE.equals(current), "Expired processing attempt");
        return params;
    }

    @Override
    @Transactional
    public void heartbeat(UUID workId, UUID attemptId) {
        var params = lease(workId, attemptId);
        jdbc.update(
                "UPDATE ingestion.run SET lease_until=clock_timestamp()+interval '5 minutes' WHERE id=:id AND lease_token=:token",
                params);
    }

    @Override
    @Transactional
    public List<Research.Checkpoint> checkpoints(UUID workId, UUID attemptId) {
        lease(workId, attemptId);
        return jdbc.query(
                "SELECT key,payload FROM research.checkpoint WHERE work_id=:id ORDER BY sequence",
                Map.of("id", workId),
                (rs, index) -> new Research.Checkpoint(rs.getString("key"), rs.getString("payload")));
    }

    @Override
    @Transactional
    public void checkpoint(UUID workId, UUID attemptId, Research.Checkpoint checkpoint) {
        require(checkpoint != null, "A checkpoint is required");
        try {
            require(json.readTree(checkpoint.payload()) != null, "Checkpoint payload must contain JSON");
        } catch (tools.jackson.core.JacksonException invalid) {
            require(false, "Checkpoint payload must contain JSON");
        }
        lease(workId, attemptId);
        var params = Map.of("id", workId, "key", checkpoint.key(), "payload", checkpoint.payload());
        jdbc.update(
                "INSERT INTO research.checkpoint(work_id,key,payload) VALUES(:id,:key,:payload) ON CONFLICT DO NOTHING",
                params);
        String saved = jdbc.queryForObject(
                "SELECT payload FROM research.checkpoint WHERE work_id=:id AND key=:key", params, String.class);
        require(checkpoint.payload().equals(saved), "A completed checkpoint cannot be changed");
    }
}
