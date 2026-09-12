package com.fiap.ford.specsync.infrastructure.gateway.ingestion;

import static com.fiap.ford.specsync.domain.ingestion.Ingestion.require;

import com.fiap.ford.specsync.domain.catalog.Catalog;
import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.ingestion.*;
import com.fiap.ford.specsync.domain.ontology.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
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
    private static final int MAX_WARNINGS = 50;
    private final NamedParameterJdbcTemplate jdbc;
    private final OntologyGateway ontology;
    private final JsonMapper json = JsonMapper.builder().build();

    public IngestionJdbcGateway(DataSource source, OntologyGateway ontology) {
        this.ontology = Objects.requireNonNull(ontology);
        jdbc = new NamedParameterJdbcTemplate(Objects.requireNonNull(source));
    }

    private String encode(Object value) {
        return json.writeValueAsString(value);
    }

    private <T> T decode(Object value, Class<T> type) {
        return json.readValue(value.toString(), type);
    }

    private Map<String, UUID> configurationIds(Object value) {
        if (value == null) return Map.of();
        return json.readValue(value.toString(), new TypeReference<Map<String, UUID>>() {});
    }

    private static String hash(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static Instant instant(Object value) {
        return value instanceof Timestamp timestamp ? timestamp.toInstant() : null;
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
    public List<Ingestion.Summary> list(String owner) {
        return jdbc.query(
                """
   SELECT id,request,status,error,created_at,updated_at,
     coalesce(jsonb_array_length(draft->'configurations'),0) AS configurations,
     coalesce((SELECT sum(jsonb_array_length(c->'claims')) FROM jsonb_array_elements(draft->'configurations') c),0) AS claims
   FROM ingestion.run WHERE owner_name=:owner ORDER BY created_at DESC LIMIT 100
   """,
                Map.of("owner", owner),
                (rs, index) -> new Ingestion.Summary(
                        (UUID) rs.getObject("id"),
                        decode(rs.getObject("request"), Ingestion.Request.class),
                        rs.getString("status"),
                        rs.getInt("configurations"),
                        rs.getInt("claims"),
                        rs.getString("error"),
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("updated_at").toInstant()));
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

    /** Catalog identity of one configuration name within the run's brand, model, market and year. */
    private UUID configuration(Ingestion.Request request, String name) {
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
                        name,
                        "market",
                        request.market(),
                        "year",
                        request.modelYear()));
        require(rows.size() <= 1, "Ambiguous catalog identity requires curation");
        return rows.isEmpty() ? null : (UUID) rows.getFirst().get("id");
    }

    /** Names the run addresses: the draft's configurations once extracted, the request's before. */
    private static List<String> configurationNames(Ingestion.Request request, Ingestion.Draft draft) {
        if (draft != null)
            return draft.configurations().stream()
                    .map(Ingestion.ConfigurationDraft::name)
                    .toList();
        return request.configurations();
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Ingestion.Run get(UUID id, String owner) {
        var saved = row(id, owner, false);
        var request = decode(saved.get("request"), Ingestion.Request.class);
        var draft = saved.get("draft") == null ? null : decode(saved.get("draft"), Ingestion.Draft.class);
        var ids = new LinkedHashMap<>(configurationIds(saved.get("configuration_ids")));
        var current = new LinkedHashMap<String, Map<String, Object>>();
        for (String name : configurationNames(request, draft)) {
            UUID configurationId = ids.containsKey(name) ? ids.get(name) : configuration(request, name);
            if (configurationId == null) continue;
            ids.put(name, configurationId);
            var cells = new LinkedHashMap<String, Object>();
            for (var cell : jdbc.queryForList(
                    "SELECT attribute_code,knowledge_status,value,availability,qualifiers FROM catalog.specification_matrix WHERE configuration_id=:id",
                    Map.of("id", configurationId))) {
                var value = new LinkedHashMap<String, Object>(cell);
                for (String key : List.of("value", "qualifiers"))
                    if (value.get(key) != null)
                        value.put(key, json.readValue(value.get(key).toString(), Object.class));
                cells.put(cell.get("attribute_code").toString(), value);
            }
            current.put(name, cells);
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
                Map.copyOf(ids),
                (String) saved.get("error"),
                projection,
                projection.equals("PENDING") ? projectionError : null,
                current,
                instant(saved.get("created_at")),
                instant(saved.get("updated_at")),
                decisions(saved.get("decisions")));
    }

    private List<Ingestion.Review> decisions(Object value) {
        if (value == null) return List.of();
        return json.readValue(value.toString(), new TypeReference<List<Ingestion.Review>>() {});
    }

    @Override
    @Transactional
    public Optional<Ingestion.Work> claim() {
        // Use the same authority-first lock order as creation and ontology activation, including
        // legacy queued work whose ontology snapshot is first pinned when it is claimed.
        jdbc.queryForObject("SELECT revision FROM ingestion.catalog_version FOR SHARE", Map.of(), Long.class);
        jdbc.update(
                "UPDATE ingestion.run SET status='FAILED',error='Processing retry limit reached',lease_token=NULL WHERE status='PROCESSING' AND lease_until<now() AND attempts>=3",
                Map.of());
        var rows = jdbc.queryForList(
                "SELECT id,request,ontology_context FROM ingestion.run WHERE (status='QUEUED' OR (status='PROCESSING' AND lease_until<now())) AND attempts<3 ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED",
                Map.of());
        if (rows.isEmpty()) return Optional.empty();
        var row = rows.getFirst();
        UUID token = UUID.randomUUID();
        UUID id = (UUID) row.get("id");
        var context = row.get("ontology_context") == null
                ? ontology.context()
                : decode(row.get("ontology_context"), Ontology.Context.class);
        jdbc.update(
                "UPDATE ingestion.run SET ontology_context=CAST(:context AS jsonb) WHERE id=:id AND ontology_context IS NULL",
                Map.of("id", id, "context", encode(context)));
        jdbc.update(
                "UPDATE ingestion.run SET status='PROCESSING',attempts=attempts+1,lease_token=:token,lease_until=now()+interval '5 minutes',updated_at=now() WHERE id=:id",
                Map.of("token", token, "id", id));
        var policies = jdbc.queryForList(
                "SELECT policy_version FROM research.work WHERE run_id=:id", Map.of("id", id), String.class);
        return Optional.of(new Ingestion.Work(
                id,
                token,
                decode(row.get("request"), Ingestion.Request.class),
                policies.isEmpty() ? null : policies.getFirst(),
                context));
    }

    @Override
    @Transactional
    public void fail(Ingestion.Work work, String error) {
        jdbc.queryForList("SELECT id FROM ingestion.run WHERE id=:id FOR UPDATE", Map.of("id", work.id()));
        jdbc.update(
                "UPDATE ingestion.run SET status=CASE WHEN attempts>=3 THEN 'FAILED' ELSE 'QUEUED' END,error=:error,lease_token=NULL,updated_at=now() WHERE id=:id AND lease_token=:token AND status='PROCESSING' AND lease_until>clock_timestamp()",
                Map.of("id", work.id(), "token", work.leaseToken(), "error", error));
    }

    private static List<String> warnings(List<String> values) {
        if (values == null) return List.of();
        require(values.size() <= MAX_WARNINGS, "Too many extraction warnings");
        for (String warning : values)
            require(warning != null && warning.length() <= 500, "Extraction warnings must be short text");
        return List.copyOf(values);
    }

    @Override
    @Transactional
    public void complete(Ingestion.Work work, Ingestion.Draft extracted) {
        var rows = jdbc.queryForList(
                "SELECT id FROM ingestion.run WHERE id=:id FOR UPDATE",
                Map.of("id", work.id(), "token", work.leaseToken()));
        require(!rows.isEmpty(), "Expired processing attempt");
        Boolean current = jdbc.queryForObject(
                "SELECT lease_token=:token AND status='PROCESSING' AND lease_until>clock_timestamp() FROM ingestion.run WHERE id=:id",
                Map.of("id", work.id(), "token", work.leaseToken()),
                Boolean.class);
        require(Boolean.TRUE.equals(current), "Expired processing attempt");
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
                extracted.configurations() != null && extracted.configurations().size() <= Ingestion.MAX_CONFIGURATIONS,
                "Maximum " + Ingestion.MAX_CONFIGURATIONS + " configurations per source");
        var attributes = new HashMap<String, Catalog.Attribute>();
        require(work.ontology() != null, "Pinned ontology context is required");
        work.ontology().attributes().forEach(attribute -> attributes.put(attribute.code(), attribute));
        require(
                extracted.ontologyRevision() == 0
                        || extracted.ontologyRevision() == work.ontology().ontologyRevision(),
                "Extractor ontology revision mismatch");
        require(
                extracted.normalizationRevision() == null
                        || extracted
                                .normalizationRevision()
                                .equals(work.ontology().normalizationRevision()),
                "Extractor normalization revision mismatch");
        var names = new HashSet<String>();
        var configurations = new ArrayList<Ingestion.ConfigurationDraft>();
        for (var configuration : extracted.configurations()) {
            require(
                    configuration.name() != null
                            && !configuration.name().isBlank()
                            && configuration.name().length() <= 150,
                    "Configuration names must be between 1 and 150 characters");
            require(
                    names.add(configuration.name().trim().toLowerCase(Locale.ROOT)),
                    "The extractor proposed the same configuration twice");
            require(
                    Ingestion.exactExcerpt(
                            source.text(),
                            configuration.identityLineStart(),
                            configuration.identityLineEnd(),
                            configuration.identityExcerpt()),
                    "Identity evidence must match the source text");
            require(
                    configuration.claims() != null && configuration.claims().size() <= Ingestion.MAX_CLAIMS,
                    "Maximum " + Ingestion.MAX_CLAIMS + " claims per configuration");
            var claims = new ArrayList<Ingestion.Claim>();
            for (var claim : configuration.claims()) claims.add(validate(source, attributes, claim, work.ontology()));
            require(
                    configuration.unmappedObservations().size() <= Ingestion.MAX_CLAIMS,
                    "Too many unmapped observations");
            var unmapped = new ArrayList<Ontology.Observation>();
            for (var observation : configuration.unmappedObservations()) {
                require(
                        observation.originalTerm() != null
                                && !observation.originalTerm().isBlank()
                                && observation.originalTerm().length() <= 150,
                        "A short observed source term is required");
                require(
                        observation.rawValue() != null
                                && !observation.rawValue().isBlank()
                                && observation.rawValue().length() <= 2000,
                        "A bounded raw observation is required");
                require(
                        Ingestion.exactExcerpt(
                                source.text(), observation.lineStart(), observation.lineEnd(), observation.excerpt()),
                        "Unmapped evidence must match source lines");
                require(
                        observation.excerpt().contains(observation.originalTerm())
                                && observation.excerpt().contains(observation.rawValue()),
                        "Unmapped source term and value must occur in evidence");
                require(
                        observation.locator() != null
                                && !observation.locator().isBlank()
                                && observation.locator().length() <= 500,
                        "An observation source location is required");
                String origin = observation.termOrigin() == null
                        ? (source.mimeType().equals("application/pdf") ? "DERIVED_TEXT" : "SOURCE_TEXT")
                        : observation.termOrigin();
                require(
                        Set.of("SOURCE_TEXT", "VISUAL_LABEL", "DERIVED_TEXT").contains(origin),
                        "Unknown source term origin");
                if (source.mimeType().equals("application/pdf")) {
                    if (!Ontology.retainsOriginalTerms(source.parserVersion())
                            || !observation.excerpt().contains("originalTerm: " + observation.originalTerm()))
                        origin = "DERIVED_TEXT";
                }
                var checked = new Ontology.Observation(
                        observation.originalTerm(),
                        observation.rawValue(),
                        observation.sourceUnit(),
                        observation.qualifiers() == null ? Map.of() : observation.qualifiers(),
                        observation.lineStart(),
                        observation.lineEnd(),
                        observation.excerpt(),
                        observation.locator(),
                        observation.proposal(),
                        origin);
                var resolved = Ontology.resolve(work.ontology(), work.request(), checked);
                if (resolved.isPresent()
                        && claims.stream().noneMatch(c -> c.attributeCode().equals(resolved.get()))) {
                    var attribute = attributes.get(resolved.get());
                    var claim = new Ingestion.Claim(
                            resolved.get(),
                            attribute.label(),
                            attribute.unit(),
                            checked.rawValue(),
                            checked.sourceUnit(),
                            null,
                            attribute.valueType().equals("LIST") ? List.of(checked.rawValue()) : null,
                            checked.qualifiers(),
                            checked.lineStart(),
                            checked.lineEnd(),
                            checked.excerpt(),
                            checked.locator(),
                            null,
                            List.of(),
                            origin.equals("DERIVED_TEXT") ? null : checked.originalTerm());
                    var normalized = validate(source, attributes, claim, work.ontology());
                    if (normalized.issues().isEmpty()) {
                        claims.add(normalized);
                        continue;
                    }
                }
                unmapped.add(checked);
            }
            configurations.add(new Ingestion.ConfigurationDraft(
                    configuration.name().trim(),
                    configuration.identityLineStart(),
                    configuration.identityLineEnd(),
                    configuration.identityExcerpt(),
                    List.copyOf(claims),
                    warnings(configuration.warnings()),
                    List.copyOf(unmapped)));
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
                List.copyOf(configurations),
                warnings(extracted.warnings()),
                work.ontology().ontologyRevision(),
                work.ontology().normalizationRevision(),
                source.parserVersion());
        ontology.observe(work, draft);
        String encoded = encode(draft);
        params.put("draft", encoded);
        params.put("hash", hash(encoded.getBytes(StandardCharsets.UTF_8)));
        jdbc.update(
                "UPDATE ingestion.run SET status='REVIEW',draft=CAST(:draft AS jsonb),draft_hash=:hash,base_revision=(SELECT revision FROM ingestion.catalog_version),lease_token=NULL,error=NULL,updated_at=now() WHERE id=:id",
                params);
    }

    /** Deterministic checks and normalization of one proposed claim; problems become review issues. */
    private static Ingestion.Claim validate(
            Ingestion.Source source,
            Map<String, Catalog.Attribute> attributes,
            Ingestion.Claim claim,
            Ontology.Context context) {
        var issues = new ArrayList<String>();
        Object value = null;
        var qualifiers = new HashMap<String, String>(claim.qualifiers() == null ? Map.of() : claim.qualifiers());
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
                                || !claim.excerpt().toLowerCase(Locale.ROOT).contains(item.toLowerCase(Locale.ROOT))))
            issues.add("A list item is not present in the supporting excerpt");
        if (claim.locator() == null || claim.locator().isBlank()) issues.add("Source location is missing");
        if (attribute != null)
            try {
                value = switch (attribute.valueType()) {
                    case "NUMBER" -> {
                        var number = Ingestion.normalizeNumber(claim.rawValue(), claim.rawUnit(), attribute.unit());
                        if (Set.of("passenger_capacity", "towing_capacity", "cargo_bed_volume")
                                .contains(attribute.code()))
                            require(number.signum() >= 0, "Capacity cannot be negative");
                        if (attribute.code().equals("passenger_capacity")) {
                            require(number.stripTrailingZeros().scale() <= 0, "Passenger capacity must be an integer");
                            qualifiers.putIfAbsent("driverIncluded", "UNKNOWN");
                            require(
                                    Set.of("YES", "NO", "UNKNOWN").contains(qualifiers.get("driverIncluded")),
                                    "Driver inclusion must be explicit or UNKNOWN");
                        }
                        if (attribute.code().equals("towing_capacity"))
                            qualifiers.putIfAbsent("brakingCondition", "UNKNOWN");
                        yield number;
                    }
                    case "TEXT" -> claim.rawValue();
                    case "LIST" -> {
                        require(
                                claim.listValue() != null
                                        && !claim.listValue().isEmpty()
                                        && claim.listValue().stream().allMatch(v -> v != null && !v.isBlank()),
                                "List items are required");
                        yield Ontology.normalizeVocabulary(context, attribute.code(), claim.listValue());
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
        return new Ingestion.Claim(
                claim.attributeCode(),
                attribute == null ? claim.attributeCode() : attribute.label(),
                attribute == null ? null : attribute.unit(),
                claim.rawValue(),
                claim.rawUnit(),
                attribute != null && attribute.valueType().equals("AVAILABILITY") ? claim.availability() : null,
                claim.listValue(),
                Map.copyOf(qualifiers),
                claim.lineStart(),
                claim.lineEnd(),
                claim.excerpt(),
                claim.locator(),
                value,
                List.copyOf(issues),
                Ontology.originalTerm(source, claim.excerpt(), claim.originalTerm()));
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
        return publish(id, owner, review, owner);
    }

    @Override
    @Transactional
    public Ingestion.Run publish(UUID id, String owner, Ingestion.Review review, String reviewer) {
        require(reviewer != null && !reviewer.isBlank(), "Reviewer identity is required");
        long revision =
                jdbc.queryForObject("SELECT revision FROM ingestion.catalog_version FOR UPDATE", Map.of(), Long.class);
        var saved = row(id, owner, true);
        // A repeated request is the same decision again: nothing new to publish, nothing to refuse.
        var decisions = decisions(saved.get("decisions"));
        if (decisions.contains(review)) return get(id, owner);
        require(Set.of("REVIEW", "PUBLISHED").contains(saved.get("status")), "Only a completed draft can be published");
        require(Objects.equals(saved.get("draft_hash"), review.draftHash()), "Draft changed; reload and review again");
        require(revision == review.baseRevision(), "Catalog changed; reload and review the current values again");
        var draft = decode(saved.get("draft"), Ingestion.Draft.class);
        Ingestion.requireUnpublished(draft, decisions, review);
        var request = decode(saved.get("request"), Ingestion.Request.class);
        UUID sourceId =
                stableId("source:" + draft.source().url() + ":" + draft.source().textSha256());
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
        var ids = new LinkedHashMap<>(configurationIds(saved.get("configuration_ids")));
        boolean changed = false;
        for (var decision : review.configurations()) {
            require(decision.configuration() < draft.configurations().size(), "Unknown configuration selection");
            var configuration = draft.configurations().get(decision.configuration());
            if (decision.selectedClaims().isEmpty()) continue;
            var selected = new ArrayList<Ingestion.Claim>();
            var seen = new HashSet<String>();
            for (int index : decision.selectedClaims()) {
                require(index >= 0 && index < configuration.claims().size(), "Unknown claim selection");
                var claim = configuration.claims().get(index);
                require(claim.issues().isEmpty(), "A selected claim has validation issues");
                require(
                        seen.add(claim.attributeCode()),
                        "Choose one claim per attribute; conflicting claims must remain pending");
                selected.add(claim);
            }
            UUID identityId = stableId("evidence:" + sourceId + ":" + configuration.identityLineStart() + ":"
                    + configuration.identityLineEnd());
            evidence(
                    identityId,
                    sourceId,
                    configuration.identityLineStart(),
                    configuration.identityLineEnd(),
                    configuration.identityExcerpt(),
                    "Reviewed vehicle identity: " + configuration.name());
            UUID config = configuration(request, configuration.name());
            if (config == null)
                config = createConfiguration(request, configuration.name(), identityId, review.reasonFor(decision));
            ids.put(configuration.name(), config);
            for (var claim : selected)
                changed |= publishClaim(
                        id,
                        reviewer,
                        review.reasonFor(decision),
                        sourceId,
                        config,
                        claim,
                        revision,
                        draft.normalizationRevision(),
                        draft.ontologyRevision(),
                        draft.readerRevision());
        }
        if (changed) {
            jdbc.update("UPDATE ingestion.catalog_version SET revision=revision+1", Map.of());
            jdbc.update(
                    "INSERT INTO ingestion.projection_event(revision,run_id) VALUES(:revision,:id)",
                    Map.of("revision", revision + 1, "id", id));
        }
        var history = new ArrayList<>(decisions);
        history.add(review);
        jdbc.update(
                "UPDATE ingestion.run SET status='PUBLISHED',configuration_ids=CAST(:ids AS jsonb),decision=CAST(:decision AS jsonb),decisions=CAST(:decisions AS jsonb),updated_at=now() WHERE id=:id",
                Map.of("ids", encode(ids), "decision", encode(review), "decisions", encode(history), "id", id));
        return get(id, owner);
    }

    private UUID createConfiguration(Ingestion.Request request, String name, UUID identityId, String reason) {
        var brands = jdbc.queryForList(
                "SELECT id FROM catalog.brand WHERE lower(name)=lower(:name)", Map.of("name", request.brand()));
        require(brands.size() <= 1, "Ambiguous brand identity");
        UUID brand =
                brands.isEmpty() ? UUID.randomUUID() : (UUID) brands.getFirst().get("id");
        if (brands.isEmpty())
            jdbc.update(
                    "INSERT INTO catalog.brand(id,name) VALUES(:id,:name)",
                    Map.of("id", brand, "name", request.brand()));
        var models = jdbc.queryForList(
                "SELECT id FROM catalog.vehicle_model WHERE brand_id=:brand AND lower(name)=lower(:name)",
                Map.of("brand", brand, "name", request.model()));
        require(models.size() <= 1, "Ambiguous model identity");
        UUID model =
                models.isEmpty() ? UUID.randomUUID() : (UUID) models.getFirst().get("id");
        if (models.isEmpty())
            jdbc.update(
                    "INSERT INTO catalog.vehicle_model(id,brand_id,name) VALUES(:id,:brand,:name)",
                    Map.of("id", model, "brand", brand, "name", request.model()));
        UUID config = UUID.randomUUID();
        var params = new HashMap<String, Object>();
        params.put("id", config);
        params.put("model", model);
        params.put("name", name);
        params.put("market", request.market());
        params.put("year", request.modelYear());
        params.put("evidence", identityId);
        params.put("note", reason);
        jdbc.update(
                "INSERT INTO catalog.vehicle_configuration(id,model_id,name,market,model_year,identity_status,identity_evidence_id,identity_note) VALUES(:id,:model,:name,:market,:year,'RESOLVED_FROM_PRIMARY_SOURCE',:evidence,:note)",
                params);
        return config;
    }

    /** Appends the evidenced assertion and moves the accepted selection; false when already accepted. */
    private boolean publishClaim(
            UUID run,
            String owner,
            String reason,
            UUID sourceId,
            UUID config,
            Ingestion.Claim claim,
            long revision,
            String normalizationRevision,
            long ontologyRevision,
            String readerRevision) {
        UUID evidence = stableId("evidence:" + sourceId + ":" + claim.lineStart() + ":" + claim.lineEnd());
        evidence(evidence, sourceId, claim.lineStart(), claim.lineEnd(), claim.excerpt(), claim.locator());
        var attribute = jdbc.queryForMap(
                "SELECT id,value_type FROM catalog.attribute_definition WHERE code=:code",
                Map.of("code", claim.attributeCode()));
        UUID attr = (UUID) attribute.get("id");
        var q = new TreeMap<String, Object>(claim.qualifiers());
        q.put("originalUnit", Objects.toString(claim.rawUnit(), ""));
        q.put("normalizerVersion", Objects.toString(normalizationRevision, "unknown"));
        q.put("ontologyRevision", ontologyRevision);
        q.put("readerRevision", Objects.toString(readerRevision, "unknown"));
        if (claim.originalTerm() != null) q.put("originalTerm", claim.originalTerm());
        UUID assertion = stableId("assertion:" + config + ":" + attr + ":" + sourceId + ":" + evidence + ":"
                + encode(Arrays.asList(claim.value(), claim.availability(), claim.rawValue(), q)));
        if (jdbc.queryForObject(
                        "SELECT count(*) FROM catalog.accepted_specification WHERE configuration_id=:config AND attribute_id=:attr AND assertion_id=:assertion AND knowledge_status='KNOWN'",
                        Map.of("config", config, "attr", attr, "assertion", assertion),
                        Long.class)
                > 0) return false;
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
        a.put("run", run);
        a.put("owner", owner);
        a.put("reason", reason);
        a.put("revision", revision + 1);
        jdbc.update(
                "INSERT INTO ingestion.selection_decision(id,run_id,reviewer,configuration_id,attribute_id,previous_selection,assertion_id,reason,revision) VALUES(:decision,:run,:owner,:config,:attr,(SELECT to_jsonb(s) FROM catalog.accepted_specification s WHERE configuration_id=:config AND attribute_id=:attr),:id,:reason,:revision)",
                a);
        jdbc.update(
                "INSERT INTO catalog.accepted_specification(configuration_id,attribute_id,knowledge_status,assertion_id,reason) VALUES(:config,:attr,'KNOWN',:id,:reason) ON CONFLICT(configuration_id,attribute_id) DO UPDATE SET knowledge_status='KNOWN',assertion_id=excluded.assertion_id,reason=excluded.reason",
                a);
        return true;
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
                "attribute_value",
                "manufacturer_term",
                "ontology_revision",
                "ontology_proposal",
                "ontology_proposal_evidence",
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
