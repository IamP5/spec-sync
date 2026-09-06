package com.fiap.ford.specsync.infrastructure.gateway.ingestion;

import static com.fiap.ford.specsync.domain.ingestion.Ingestion.require;

import com.fiap.ford.specsync.domain.catalog.Catalog;
import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.ingestion.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class IngestionJdbcGateway implements IngestionGateway {
    private final NamedParameterJdbcTemplate jdbc;
    private final JsonMapper json = JsonMapper.builder().build();

    public IngestionJdbcGateway(DataSource source) {
        jdbc = new NamedParameterJdbcTemplate(Objects.requireNonNull(source));
    }

    private String encode(Object value) {
        return json.writeValueAsString(value);
    }

    private <T> T decode(Object value, Class<T> type) {
        return json.readValue(value.toString(), type);
    }

    private Map<String, Object> map(String value) {
        return json.readValue(value, new TypeReference<Map<String, Object>>() {});
    }

    private static String hash(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private Map<String, Object> row(UUID id, String owner, boolean lock) {
        var rows = jdbc.queryForList(
                "SELECT * FROM ingestion.run WHERE id=:id AND owner_name=:owner" + (lock ? " FOR UPDATE" : ""),
                Map.of("id", id, "owner", owner));
        require(!rows.isEmpty(), "Ingestion run not found");
        return rows.getFirst();
    }

    @Override
    @Transactional
    public Ingestion.Run create(UUID id, String owner, Ingestion.Request request) {
        require(id != null && owner != null, "Request identity is required");
        jdbc.update(
                "INSERT INTO ingestion.run(id,owner_name,request,status) VALUES(:id,:owner,CAST(:request AS jsonb),'QUEUED') ON CONFLICT DO NOTHING",
                Map.of("id", id, "owner", owner, "request", encode(request)));
        var saved = row(id, owner, false);
        require(
                decode(saved.get("request"), Ingestion.Request.class).equals(request),
                "Request ID already belongs to a different import");
        return get(id, owner);
    }

    @Override
    @Transactional(readOnly = true)
    public Ingestion.CapturedFile source(UUID id, String owner) {
        row(id, owner, false);
        var rows = jdbc.queryForList(
                "SELECT original_bytes,mime_type FROM ingestion.source_capture WHERE run_id=:id", Map.of("id", id));
        require(!rows.isEmpty(), "No captured source is available for this run");
        var saved = rows.getFirst();
        return new Ingestion.CapturedFile(
                (byte[]) saved.get("original_bytes"), saved.get("mime_type").toString());
    }

    private UUID configuration(Ingestion.Request request) {
        var rows = jdbc.queryForList(
                """
   SELECT c.id FROM catalog.vehicle_configuration c JOIN catalog.vehicle_model m ON m.id=c.model_id JOIN catalog.brand b ON b.id=m.brand_id
   WHERE lower(b.name)=lower(:brand) AND lower(m.name)=lower(:model) AND lower(c.name)=lower(:name) AND c.market=:market AND c.model_year=:year
   """,
                Map.of(
                        "brand",
                        request.brand(),
                        "model",
                        request.model(),
                        "name",
                        request.name(),
                        "market",
                        request.market(),
                        "year",
                        request.modelYear()));
        require(rows.size() <= 1, "Ambiguous catalog identity requires curation");
        UUID found = rows.isEmpty() ? null : (UUID) rows.getFirst().get("id");
        if (request.configurationId() != null)
            require(request.configurationId().equals(found), "Configuration ID does not match the submitted identity");
        return found;
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Ingestion.Run get(UUID id, String owner) {
        var saved = row(id, owner, false);
        var request = decode(saved.get("request"), Ingestion.Request.class);
        var draft = saved.get("draft") == null ? null : decode(saved.get("draft"), Ingestion.Draft.class);
        var current = new LinkedHashMap<String, Object>();
        UUID configurationId = (UUID) saved.get("configuration_id");
        if (configurationId == null) configurationId = configuration(request);
        if (configurationId != null)
            for (var cell : jdbc.queryForList(
                    "SELECT attribute_code,knowledge_status,value,availability,qualifiers FROM catalog.specification_matrix WHERE configuration_id=:id",
                    Map.of("id", configurationId))) {
                var value = new LinkedHashMap<String, Object>(cell);
                for (String key : List.of("value", "qualifiers"))
                    if (value.get(key) != null)
                        value.put(key, json.readValue(value.get(key).toString(), Object.class));
                current.put(cell.get("attribute_code").toString(), value);
            }
        long revision = jdbc.queryForObject("SELECT revision FROM ingestion.catalog_version", Map.of(), Long.class);
        var event = jdbc.queryForList(
                "SELECT applied_at FROM ingestion.projection_event WHERE run_id=:id", Map.of("id", id));
        String projection = event.isEmpty()
                ? (saved.get("status").equals("PUBLISHED") ? "UNCHANGED" : "NOT_REQUESTED")
                : event.getFirst().get("applied_at") == null ? "PENDING" : "CURRENT";
        String projectionError =
                jdbc.queryForObject("SELECT error FROM ingestion.projection_state", Map.of(), String.class);
        return new Ingestion.Run(
                id,
                request,
                saved.get("status").toString(),
                ((Number) saved.get("attempts")).intValue(),
                draft,
                (String) saved.get("draft_hash"),
                revision,
                configurationId,
                (String) saved.get("error"),
                projection,
                projection.equals("PENDING") ? projectionError : null,
                current);
    }

    @Override
    @Transactional
    public Optional<Ingestion.Work> claim() {
        jdbc.update(
                "UPDATE ingestion.run SET status='FAILED',error='Processing retry limit reached',lease_token=NULL WHERE status='PROCESSING' AND lease_until<now() AND attempts>=3",
                Map.of());
        var rows = jdbc.queryForList(
                "SELECT id,request FROM ingestion.run WHERE (status='QUEUED' OR (status='PROCESSING' AND lease_until<now())) AND attempts<3 ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED",
                Map.of());
        if (rows.isEmpty()) return Optional.empty();
        var row = rows.getFirst();
        UUID token = UUID.randomUUID();
        UUID id = (UUID) row.get("id");
        jdbc.update(
                "UPDATE ingestion.run SET status='PROCESSING',attempts=attempts+1,lease_token=:token,lease_until=now()+interval '5 minutes',updated_at=now() WHERE id=:id",
                Map.of("token", token, "id", id));
        return Optional.of(new Ingestion.Work(id, token, decode(row.get("request"), Ingestion.Request.class)));
    }

    @Override
    @Transactional
    public void fail(Ingestion.Work work, String error) {
        jdbc.update(
                "UPDATE ingestion.run SET status=CASE WHEN attempts>=3 THEN 'FAILED' ELSE 'QUEUED' END,error=:error,lease_token=NULL,updated_at=now() WHERE id=:id AND lease_token=:token AND status='PROCESSING'",
                Map.of("id", work.id(), "token", work.leaseToken(), "error", error));
    }

    @Override
    @Transactional
    public void complete(Ingestion.Work work, Ingestion.Draft extracted) {
        var rows = jdbc.queryForList(
                "SELECT id FROM ingestion.run WHERE id=:id AND lease_token=:token AND status='PROCESSING' AND lease_until>now() FOR UPDATE",
                Map.of("id", work.id(), "token", work.leaseToken()));
        require(!rows.isEmpty(), "Expired processing attempt");
        var source = extracted.source();
        require(source != null, "Source capture required");
        byte[] original = Base64.getDecoder().decode(source.originalBase64());
        require(original.length > 0 && original.length <= 5_000_000, "Source size exceeds limit");
        require(
                source.text() != null
                        && source.text().length() <= 150_000
                        && !source.text().contains("\u0000"),
                "Source text exceeds limit or contains invalid characters");
        require(
                hash(original).equals(source.originalSha256())
                        && hash(source.text().getBytes(StandardCharsets.UTF_8)).equals(source.textSha256()),
                "Source checksum mismatch");
        require(
                Ingestion.exactExcerpt(
                        source.text(),
                        extracted.identityLineStart(),
                        extracted.identityLineEnd(),
                        extracted.identityExcerpt()),
                "Identity evidence must match the source text");
        require(extracted.claims() != null && extracted.claims().size() <= 100, "Maximum 100 claims per source");
        var attributes = new HashMap<String, Catalog.Attribute>();
        jdbc.query("SELECT * FROM catalog.attribute_definition", Map.of(), rs -> {
            attributes.put(
                    rs.getString("code"),
                    new Catalog.Attribute(
                            (UUID) rs.getObject("id"),
                            rs.getString("code"),
                            rs.getString("label"),
                            rs.getString("description"),
                            rs.getString("value_type"),
                            rs.getString("unit")));
        });
        var claims = new ArrayList<Ingestion.Claim>();
        for (var claim : extracted.claims()) {
            var issues = new ArrayList<String>();
            Object value = null;
            var attribute = attributes.get(claim.attributeCode());
            if (attribute == null) issues.add("Unknown attribute");
            if (!Ingestion.exactExcerpt(source.text(), claim.lineStart(), claim.lineEnd(), claim.excerpt()))
                issues.add("Evidence does not match source lines");
            if (claim.rawValue() == null || claim.rawValue().isBlank()) issues.add("Raw source value is missing");
            if (claim.rawValue() != null
                    && claim.excerpt() != null
                    && !claim.excerpt()
                            .toLowerCase(Locale.ROOT)
                            .contains(claim.rawValue().toLowerCase(Locale.ROOT)))
                issues.add("Raw value is not present in the supporting excerpt");
            if (claim.listValue() != null
                    && claim.excerpt() != null
                    && claim.listValue().stream()
                            .anyMatch(item -> item == null
                                    || !claim.excerpt()
                                            .toLowerCase(Locale.ROOT)
                                            .contains(item.toLowerCase(Locale.ROOT))))
                issues.add("A list item is not present in the supporting excerpt");
            if (claim.locator() == null || claim.locator().isBlank()) issues.add("Source location is missing");
            if (attribute != null)
                try {
                    value = switch (attribute.valueType()) {
                        case "NUMBER" -> Ingestion.normalizeNumber(claim.rawValue(), claim.rawUnit(), attribute.unit());
                        case "TEXT" -> claim.rawValue();
                        case "LIST" -> {
                            require(
                                    claim.listValue() != null
                                            && !claim.listValue().isEmpty()
                                            && claim.listValue().stream().allMatch(v -> v != null && !v.isBlank()),
                                    "List items are required");
                            yield claim.listValue();
                        }
                        case "AVAILABILITY" -> {
                            require(
                                    claim.availability() != null
                                            && Set.of("STANDARD", "OPTIONAL", "ABSENT", "NOT_APPLICABLE")
                                                    .contains(claim.availability()),
                                    "Equipment requires a source-defined availability");
                            yield null;
                        }
                        default -> throw new IllegalStateException("Unsupported attribute type");
                    };
                } catch (DomainException e) {
                    issues.add(e.getMessage());
                }
            claims.add(new Ingestion.Claim(
                    claim.attributeCode(),
                    attribute == null ? claim.attributeCode() : attribute.label(),
                    attribute == null ? null : attribute.unit(),
                    claim.rawValue(),
                    claim.rawUnit(),
                    attribute != null && attribute.valueType().equals("AVAILABILITY") ? claim.availability() : null,
                    claim.listValue(),
                    claim.qualifiers() == null ? Map.of() : claim.qualifiers(),
                    claim.lineStart(),
                    claim.lineEnd(),
                    claim.excerpt(),
                    claim.locator(),
                    value,
                    List.copyOf(issues)));
        }
        var params = new HashMap<String, Object>();
        params.put("id", work.id());
        params.put("url", source.url());
        params.put("title", source.title());
        params.put("mime", source.mimeType());
        params.put("bytes", original);
        params.put("sha", source.originalSha256());
        params.put("text", source.text());
        params.put("textSha", source.textSha256());
        params.put("parser", source.parserVersion());
        jdbc.update(
                "INSERT INTO ingestion.source_capture(run_id,url,title,mime_type,original_bytes,original_sha256,text_content,text_sha256,parser_version) VALUES(:id,:url,:title,:mime,:bytes,:sha,:text,:textSha,:parser)",
                params);
        var storedSource = new Ingestion.Source(
                source.url(),
                source.title(),
                source.mimeType(),
                null,
                source.originalSha256(),
                source.text(),
                source.textSha256(),
                source.parserVersion());
        var draft = new Ingestion.Draft(
                storedSource,
                extracted.identityLineStart(),
                extracted.identityLineEnd(),
                extracted.identityExcerpt(),
                List.copyOf(claims));
        String encoded = encode(draft);
        params.put("draft", encoded);
        params.put("hash", hash(encoded.getBytes(StandardCharsets.UTF_8)));
        jdbc.update(
                "UPDATE ingestion.run SET status='REVIEW',draft=CAST(:draft AS jsonb),draft_hash=:hash,base_revision=(SELECT revision FROM ingestion.catalog_version),lease_token=NULL,error=NULL,updated_at=now() WHERE id=:id",
                params);
    }

    @Override
    @Transactional
    public Ingestion.Run reject(UUID id, String owner) {
        var saved = row(id, owner, true);
        require(!saved.get("status").equals("PUBLISHED"), "Published imports require a new correction import");
        jdbc.update(
                "UPDATE ingestion.run SET status='REJECTED',lease_token=NULL,updated_at=now() WHERE id=:id",
                Map.of("id", id));
        return get(id, owner);
    }

    @Override
    @Transactional
    public Ingestion.Run publish(UUID id, String owner, Ingestion.Review review) {
        long revision =
                jdbc.queryForObject("SELECT revision FROM ingestion.catalog_version FOR UPDATE", Map.of(), Long.class);
        var saved = row(id, owner, true);
        if (saved.get("status").equals("PUBLISHED")) {
            require(
                    decode(saved.get("decision"), Ingestion.Review.class).equals(review),
                    "This import was already published with another decision");
            return get(id, owner);
        }
        require(saved.get("status").equals("REVIEW"), "Only a completed draft can be published");
        require(Objects.equals(saved.get("draft_hash"), review.draftHash()), "Draft changed; reload and review again");
        require(revision == review.baseRevision(), "Catalog changed; reload and review the current values again");
        var draft = decode(saved.get("draft"), Ingestion.Draft.class);
        var request = decode(saved.get("request"), Ingestion.Request.class);
        var selected = new ArrayList<Ingestion.Claim>();
        var seen = new HashSet<String>();
        for (int index : review.selectedClaims()) {
            require(index >= 0 && index < draft.claims().size(), "Unknown claim selection");
            var claim = draft.claims().get(index);
            require(claim.issues().isEmpty(), "A selected claim has validation issues");
            require(
                    seen.add(claim.attributeCode()),
                    "Choose one claim per attribute; conflicting claims must remain pending");
            selected.add(claim);
        }
        UUID config = configuration(request);
        UUID sourceId =
                stableId("source:" + draft.source().url() + ":" + draft.source().textSha256());
        UUID identityId =
                stableId("evidence:" + sourceId + ":" + draft.identityLineStart() + ":" + draft.identityLineEnd());
        boolean changed = false;
        var params = new HashMap<String, Object>();
        params.put("run", id);
        params.put("source", sourceId);
        params.put("path", "ingestion/" + sourceId + "/source.txt");
        params.put("sha", draft.source().textSha256());
        params.put("title", draft.source().title());
        params.put("urls", encode(List.of(draft.source().url())));
        jdbc.update(
                "INSERT INTO catalog.source_revision(id,path,sha256,title,provenance,upstream_urls,captured_on) VALUES(:source,:path,:sha,:title,'PRIMARY_SOURCE',CAST(:urls AS jsonb),(SELECT captured_at::date FROM ingestion.source_capture WHERE run_id=:run)) ON CONFLICT(id) DO NOTHING",
                params);
        evidence(
                identityId,
                sourceId,
                draft.identityLineStart(),
                draft.identityLineEnd(),
                draft.identityExcerpt(),
                "Reviewed vehicle identity");
        if (config == null) {
            var brands = jdbc.queryForList(
                    "SELECT id FROM catalog.brand WHERE lower(name)=lower(:name)", Map.of("name", request.brand()));
            require(brands.size() <= 1, "Ambiguous brand identity");
            UUID brand = brands.isEmpty()
                    ? UUID.randomUUID()
                    : (UUID) brands.getFirst().get("id");
            if (brands.isEmpty())
                jdbc.update(
                        "INSERT INTO catalog.brand(id,name) VALUES(:id,:name)",
                        Map.of("id", brand, "name", request.brand()));
            var models = jdbc.queryForList(
                    "SELECT id FROM catalog.vehicle_model WHERE brand_id=:brand AND lower(name)=lower(:name)",
                    Map.of("brand", brand, "name", request.model()));
            require(models.size() <= 1, "Ambiguous model identity");
            UUID model = models.isEmpty()
                    ? UUID.randomUUID()
                    : (UUID) models.getFirst().get("id");
            if (models.isEmpty())
                jdbc.update(
                        "INSERT INTO catalog.vehicle_model(id,brand_id,name) VALUES(:id,:brand,:name)",
                        Map.of("id", model, "brand", brand, "name", request.model()));
            config = UUID.randomUUID();
            jdbc.update(
                    "INSERT INTO catalog.vehicle_configuration(id,model_id,name,market,model_year,identity_status,identity_evidence_id,identity_note) VALUES(:id,:model,:name,:market,:year,'RESOLVED_FROM_PRIMARY_SOURCE',:evidence,:note)",
                    Map.of(
                            "id",
                            config,
                            "model",
                            model,
                            "name",
                            request.name(),
                            "market",
                            request.market(),
                            "year",
                            request.modelYear(),
                            "evidence",
                            identityId,
                            "note",
                            review.reason()));
        }
        for (var claim : selected) {
            UUID evidence = stableId("evidence:" + sourceId + ":" + claim.lineStart() + ":" + claim.lineEnd());
            evidence(evidence, sourceId, claim.lineStart(), claim.lineEnd(), claim.excerpt(), claim.locator());
            var attribute = jdbc.queryForMap(
                    "SELECT id,value_type FROM catalog.attribute_definition WHERE code=:code",
                    Map.of("code", claim.attributeCode()));
            UUID attr = (UUID) attribute.get("id");
            var q = new TreeMap<String, Object>(claim.qualifiers());
            q.put("originalUnit", Objects.toString(claim.rawUnit(), ""));
            q.put("normalizerVersion", "1");
            UUID assertion = stableId("assertion:" + config + ":" + attr + ":" + sourceId + ":" + evidence + ":"
                    + encode(Arrays.asList(claim.value(), claim.availability(), claim.rawValue(), q)));
            if (jdbc.queryForObject(
                            "SELECT count(*) FROM catalog.accepted_specification WHERE configuration_id=:config AND attribute_id=:attr AND assertion_id=:assertion AND knowledge_status='KNOWN'",
                            Map.of("config", config, "attr", attr, "assertion", assertion),
                            Long.class)
                    > 0) continue;
            changed = true;
            var a = new HashMap<String, Object>();
            a.put("id", assertion);
            a.put("config", config);
            a.put("attr", attr);
            a.put("type", attribute.get("value_type"));
            a.put("value", claim.value() == null ? null : encode(claim.value()));
            a.put("availability", claim.availability());
            a.put("qualifiers", encode(q));
            a.put("raw", claim.rawValue());
            jdbc.update(
                    "INSERT INTO catalog.spec_assertion(id,configuration_id,attribute_id,value_type,value,availability,qualifiers,raw_value,review_status) VALUES(:id,:config,:attr,:type,CAST(:value AS jsonb),:availability,CAST(:qualifiers AS jsonb),:raw,'VERIFIED') ON CONFLICT(id) DO NOTHING",
                    a);
            jdbc.update(
                    "INSERT INTO catalog.assertion_evidence(assertion_id,evidence_id) VALUES(:assertion,:evidence) ON CONFLICT DO NOTHING",
                    Map.of("assertion", assertion, "evidence", evidence));
            a.put("decision", UUID.randomUUID());
            a.put("run", id);
            a.put("owner", owner);
            a.put("reason", review.reason());
            a.put("revision", revision + 1);
            jdbc.update(
                    "INSERT INTO ingestion.selection_decision(id,run_id,reviewer,configuration_id,attribute_id,previous_selection,assertion_id,reason,revision) VALUES(:decision,:run,:owner,:config,:attr,(SELECT to_jsonb(s) FROM catalog.accepted_specification s WHERE configuration_id=:config AND attribute_id=:attr),:id,:reason,:revision)",
                    a);
            jdbc.update(
                    "INSERT INTO catalog.accepted_specification(configuration_id,attribute_id,knowledge_status,assertion_id,reason) VALUES(:config,:attr,'KNOWN',:id,:reason) ON CONFLICT(configuration_id,attribute_id) DO UPDATE SET knowledge_status='KNOWN',assertion_id=excluded.assertion_id,reason=excluded.reason",
                    a);
        }
        if (changed) {
            jdbc.update("UPDATE ingestion.catalog_version SET revision=revision+1", Map.of());
            jdbc.update(
                    "INSERT INTO ingestion.projection_event(revision,run_id) VALUES(:revision,:id)",
                    Map.of("revision", revision + 1, "id", id));
        }
        jdbc.update(
                "UPDATE ingestion.run SET status='PUBLISHED',configuration_id=:config,decision=CAST(:decision AS jsonb),updated_at=now() WHERE id=:id",
                Map.of("config", config, "decision", encode(review), "id", id));
        return get(id, owner);
    }

    private static UUID stableId(String value) {
        return UUID.nameUUIDFromBytes(value.getBytes(StandardCharsets.UTF_8));
    }

    private void evidence(UUID id, UUID source, int start, int end, String excerpt, String locator) {
        jdbc.update(
                "INSERT INTO catalog.evidence(id,source_revision_id,line_start,line_end,excerpt,locator) VALUES(:id,:source,:start,:end,:excerpt,:locator) ON CONFLICT(id) DO NOTHING",
                Map.of("id", id, "source", source, "start", start, "end", end, "excerpt", excerpt, "locator", locator));
    }

    @Override
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public Optional<Ingestion.Projection> claimProjection() {
        var states = jdbc.queryForList(
                "SELECT id FROM ingestion.projection_state WHERE lease_until IS NULL OR lease_until<now() FOR UPDATE SKIP LOCKED",
                Map.of());
        if (states.isEmpty()) return Optional.empty();
        if (jdbc.queryForObject(
                        "SELECT count(*) FROM ingestion.projection_event WHERE applied_at IS NULL",
                        Map.of(),
                        Long.class)
                == 0) return Optional.empty();
        long revision = jdbc.queryForObject("SELECT revision FROM ingestion.catalog_version", Map.of(), Long.class);
        UUID token = UUID.randomUUID();
        jdbc.update(
                "UPDATE ingestion.projection_state SET lease_token=:token,lease_until=now()+interval '5 minutes'",
                Map.of("token", token));
        var snapshot = new LinkedHashMap<String, Object>();
        for (String table : List.of(
                "brand",
                "vehicle_model",
                "vehicle_configuration",
                "attribute_definition",
                "source_revision",
                "evidence",
                "spec_assertion",
                "assertion_evidence",
                "accepted_specification",
                "feature_package",
                "package_item",
                "configuration_package",
                "seed_dataset",
                "attribute_alias",
                "review_source_revision",
                "review_chunk",
                "review_aspect",
                "review_aspect_attribute",
                "review_observation")) {
            String rows = jdbc.queryForObject(
                    "SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text FROM catalog."
                            + table + " t",
                    Map.of(),
                    String.class);
            snapshot.put(table, json.readValue(rows, Object.class));
        }
        return Optional.of(new Ingestion.Projection(token, revision, encode(snapshot)));
    }

    @Override
    @Transactional
    public void finishProjection(Ingestion.Projection work, String error) {
        var params = new HashMap<String, Object>();
        params.put("token", work.leaseToken());
        params.put("revision", work.revision());
        params.put("error", error);
        var rows = jdbc.queryForList(
                "SELECT id FROM ingestion.projection_state WHERE lease_token=:token FOR UPDATE", params);
        if (rows.isEmpty()) return;
        if (error == null)
            jdbc.update(
                    "UPDATE ingestion.projection_event SET applied_at=now() WHERE revision<=:revision AND applied_at IS NULL",
                    params);
        jdbc.update(
                "UPDATE ingestion.projection_state SET applied_revision=CASE WHEN CAST(:error AS text) IS NULL THEN :revision ELSE applied_revision END,error=:error,lease_token=NULL,lease_until=now()+interval '10 seconds'",
                params);
    }
}
