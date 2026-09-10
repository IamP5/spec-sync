package com.fiap.ford.specsync.infrastructure.gateway.ontology;

import static com.fiap.ford.specsync.domain.ingestion.Ingestion.require;

import com.fiap.ford.specsync.domain.catalog.Catalog;
import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import com.fiap.ford.specsync.domain.ontology.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class OntologyJdbcGateway implements OntologyGateway {
    private final NamedParameterJdbcTemplate jdbc;
    private final JsonMapper json = JsonMapper.builder().build();

    public OntologyJdbcGateway(DataSource source) {
        jdbc = new NamedParameterJdbcTemplate(Objects.requireNonNull(source));
    }

    private String encode(Object value) {
        return json.writeValueAsString(value);
    }

    private static String hash(String value) {
        try {
            return HexFormat.of()
                    .formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    @Override
    @Transactional
    public Ontology.Context context() {
        jdbc.queryForObject("SELECT revision FROM ingestion.catalog_version FOR SHARE", Map.of(), Long.class);
        long revision =
                jdbc.queryForObject("SELECT max(revision) FROM catalog.ontology_revision", Map.of(), Long.class);
        var attributes = jdbc.query(
                "SELECT * FROM catalog.attribute_definition ORDER BY code",
                Map.of(),
                (rs, index) -> new Catalog.Attribute(
                        (UUID) rs.getObject("id"),
                        rs.getString("code"),
                        rs.getString("label"),
                        rs.getString("description"),
                        rs.getString("value_type"),
                        rs.getString("unit")));
        var terms = jdbc.query(
                """
                SELECT a.code,t.term,t.brand,nullif(t.model,'') AS model,t.market,t.language,nullif(t.model_year,0) AS model_year
                FROM catalog.manufacturer_term t JOIN catalog.attribute_definition a ON a.id=t.attribute_id
                UNION ALL SELECT a.code,t.term,NULL,NULL,NULL,t.language,NULL
                FROM catalog.attribute_alias t JOIN catalog.attribute_definition a ON a.id=t.attribute_id
                ORDER BY code,term
                """,
                Map.of(),
                (rs, index) -> new Ontology.Term(
                        rs.getString("code"),
                        rs.getString("term"),
                        rs.getString("brand"),
                        rs.getString("model"),
                        rs.getString("market"),
                        rs.getString("language"),
                        (Integer) rs.getObject("model_year")));
        var values = jdbc.query(
                "SELECT a.code AS attribute_code,v.code,v.aliases FROM catalog.attribute_value v JOIN catalog.attribute_definition a ON a.id=v.attribute_id ORDER BY a.code,v.code",
                Map.of(),
                (rs, index) -> new Ontology.AttributeValue(
                        rs.getString("attribute_code"),
                        rs.getString("code"),
                        json.readValue(rs.getString("aliases"), new TypeReference<List<String>>() {})));
        return new Ontology.Context(revision, Ontology.NORMALIZATION_REVISION, attributes, terms, values);
    }

    @Override
    @Transactional
    public void observe(Ingestion.Work work, Ingestion.Draft draft) {
        for (var configuration : draft.configurations())
            for (var observation : configuration.unmappedObservations()) {
                var candidate = observation.proposal();
                if (candidate == null) continue;
                require(
                        Set.of("ADD_ATTRIBUTE", "ADD_ALIAS", "EXTEND_VOCABULARY", "REVIEW_SEMANTICS")
                                .contains(candidate.kind()),
                        "Unknown ontology proposal kind");
                require(
                        Set.of("NUMBER", "TEXT", "LIST", "AVAILABILITY").contains(candidate.valueType()),
                        "Unknown ontology value type");
                require(
                        candidate.definition() != null
                                && !candidate.definition().isBlank()
                                && candidate.definition().length() <= 2000,
                        "A bounded proposed definition is required");
                require(
                        candidate.alternatives() == null
                                || (candidate.alternatives().size() <= 10
                                        && candidate.alternatives().stream()
                                                .allMatch(v -> v != null && v.length() <= 500)),
                        "Proposal alternatives exceed limit");
                var parameters = new HashMap<String, Object>();
                parameters.put("id", UUID.randomUUID());
                parameters.put("kind", candidate.kind());
                parameters.put("brand", Ontology.key(work.request().brand()));
                parameters.put(
                        "model",
                        Ontology.modelKey(work.request().brand(), work.request().model()));
                parameters.put("market", work.request().market());
                parameters.put("year", work.request().modelYear());
                parameters.put("term", observation.originalTerm());
                parameters.put("termKey", Ontology.key(observation.originalTerm()));
                parameters.put("origin", observation.termOrigin());
                parameters.put("attribute", candidate.attributeCode());
                parameters.put("code", candidate.proposedCode());
                parameters.put("label", candidate.label());
                parameters.put("definition", candidate.definition());
                parameters.put("type", candidate.valueType());
                parameters.put("unit", candidate.unit());
                parameters.put("dimension", candidate.dimension());
                parameters.put(
                        "alternatives",
                        encode(candidate.alternatives() == null ? List.of() : candidate.alternatives()));
                parameters.put("revision", work.ontology().ontologyRevision());
                // Candidate spelling is not identity: include meaning and value contract, but exclude run/user.
                parameters.put(
                        "fingerprint",
                        hash(encode(Arrays.asList(
                                candidate.kind(),
                                parameters.get("brand"),
                                parameters.get("model"),
                                parameters.get("market"),
                                parameters.get("year"),
                                parameters.get("termKey"),
                                candidate.attributeCode(),
                                Ontology.key(candidate.definition()),
                                candidate.valueType(),
                                Ontology.key(candidate.unit()),
                                Ontology.key(candidate.dimension()),
                                candidate.kind().equals("EXTEND_VOCABULARY")
                                        ? Ontology.key(observation.rawValue())
                                        : ""))));
                jdbc.update("""
                    INSERT INTO catalog.ontology_proposal(id,fingerprint,kind,brand,model,market,language,model_year,term,term_key,term_origin,attribute_code,proposed_code,label,definition,value_type,unit,dimension,alternatives,base_revision)
                    VALUES(:id,:fingerprint,:kind,:brand,:model,:market,'pt-BR',:year,:term,:termKey,:origin,:attribute,:code,:label,:definition,:type,:unit,:dimension,CAST(:alternatives AS jsonb),:revision) ON CONFLICT(fingerprint) DO NOTHING
                    """, parameters);
                UUID proposal = jdbc.queryForObject(
                        "SELECT id FROM catalog.ontology_proposal WHERE fingerprint=:fingerprint",
                        parameters,
                        UUID.class);
                parameters.put("proposal", proposal);
                parameters.put("run", work.id());
                parameters.put("configuration", configuration.name());
                parameters.put("sha", draft.source().originalSha256());
                parameters.put("reader", draft.source().parserVersion());
                parameters.put("observation", encode(observation));
                jdbc.update("""
                    INSERT INTO catalog.ontology_proposal_evidence(id,proposal_id,run_id,configuration_name,source_sha256,reader_revision,observation)
                    VALUES(:id,:proposal,:run,:configuration,:sha,:reader,CAST(:observation AS jsonb)) ON CONFLICT DO NOTHING
                    """, parameters);
                Boolean exact = jdbc.queryForObject(
                        "SELECT observation=CAST(:observation AS jsonb) FROM catalog.ontology_proposal_evidence WHERE proposal_id=:proposal AND run_id=:run AND configuration_name=:configuration AND md5(observation::text)=md5(CAST(:observation AS jsonb)::text)",
                        parameters,
                        Boolean.class);
                require(Boolean.TRUE.equals(exact), "Ontology evidence identity collision");
            }
    }

    private Ontology.Candidate candidate(Map<String, Object> row) {
        return new Ontology.Candidate(
                (String) row.get("kind"),
                (String) row.get("attribute_code"),
                (String) row.get("proposed_code"),
                (String) row.get("label"),
                (String) row.get("definition"),
                (String) row.get("value_type"),
                (String) row.get("unit"),
                (String) row.get("dimension"),
                json.readValue(row.get("alternatives").toString(), new TypeReference<List<String>>() {}));
    }

    @Override
    @Transactional(readOnly = true)
    public Ontology.Overview list() {
        long revision =
                jdbc.queryForObject("SELECT max(revision) FROM catalog.ontology_revision", Map.of(), Long.class);
        var state = jdbc.queryForMap("SELECT applied_revision,error FROM ingestion.projection_state", Map.of());
        var proposals = jdbc
                .queryForList(
                        "SELECT p.*, (SELECT count(*) FROM catalog.ontology_proposal_evidence e WHERE e.proposal_id=p.id) AS evidence_count FROM catalog.ontology_proposal p ORDER BY created_at DESC LIMIT 200",
                        Map.of())
                .stream()
                .map(row -> new Ontology.Proposal(
                        (UUID) row.get("id"),
                        (String) row.get("kind"),
                        (String) row.get("status"),
                        (String) row.get("term"),
                        (String) row.get("brand"),
                        (String) row.get("model"),
                        (String) row.get("market"),
                        ((Number) row.get("model_year")).intValue(),
                        candidate(row),
                        ((Number) row.get("base_revision")).longValue(),
                        row.get("activated_revision") == null
                                ? null
                                : ((Number) row.get("activated_revision")).longValue(),
                        ((Number) row.get("evidence_count")).intValue(),
                        (String) row.get("reason")))
                .toList();
        long projected = jdbc.queryForObject(
                "SELECT coalesce(max(ontology_revision),0) FROM ingestion.projection_event WHERE applied_at IS NOT NULL",
                Map.of(),
                Long.class);
        return new Ontology.Overview(revision, projected, (String) state.get("error"), proposals);
    }

    @Override
    @Transactional
    public Ontology.Overview activate(UUID id, String reviewer, Ontology.Decision decision) {
        require(id != null && reviewer != null && !reviewer.isBlank(), "A curator identity is required");
        // The existing catalog lock serializes ontology changes and vehicle publication in one outbox.
        long catalogRevision =
                jdbc.queryForObject("SELECT revision FROM ingestion.catalog_version FOR UPDATE", Map.of(), Long.class);
        long revision = jdbc.queryForObject(
                "SELECT revision FROM catalog.ontology_revision ORDER BY revision DESC LIMIT 1 FOR UPDATE",
                Map.of(),
                Long.class);
        var rows =
                jdbc.queryForList("SELECT * FROM catalog.ontology_proposal WHERE id=:id FOR UPDATE", Map.of("id", id));
        require(!rows.isEmpty(), "Ontology proposal not found");
        var row = rows.getFirst();
        if ("ACTIVATED".equals(row.get("status"))) return list();
        require(revision == decision.baseRevision(), "Ontology changed; reload and review the current definitions");
        var candidate = candidate(row);
        require(
                Set.of("ADD_ATTRIBUTE", "ADD_ALIAS", "EXTEND_VOCABULARY").contains(candidate.kind()),
                "Possible merge/split requires a separately reviewed implementation");
        var evidence = jdbc.queryForList(
                "SELECT * FROM catalog.ontology_proposal_evidence WHERE proposal_id=:id ORDER BY CASE WHEN observation->>'termOrigin' IN ('SOURCE_TEXT','VISUAL_LABEL') THEN 0 ELSE 1 END,id LIMIT 1",
                Map.of("id", id));
        require(!evidence.isEmpty(), "Ontology activation requires retained source evidence");
        var params = new HashMap<String, Object>(row);
        params.put("newRevision", revision + 1);
        params.put("reason", decision.reason());
        params.put("reviewer", reviewer);
        params.put("sha", evidence.getFirst().get("source_sha256"));
        var observation = json.readValue(evidence.getFirst().get("observation").toString(), Ontology.Observation.class);
        params.put("locator", observation.locator());
        UUID attribute;
        if ("ADD_ATTRIBUTE".equals(candidate.kind())) {
            require(
                    candidate.proposedCode() != null && candidate.proposedCode().matches("[a-z][a-z0-9_]{1,79}"),
                    "A stable attribute code is required");
            require(
                    candidate.label() != null
                            && !candidate.label().isBlank()
                            && candidate.label().length() <= 150,
                    "A short canonical label is required");
            require(
                    "NUMBER".equals(candidate.valueType()) || candidate.unit() == null,
                    "Only numeric attributes have units");
            require(
                    !"NUMBER".equals(candidate.valueType())
                            || Set.of("kg", "L", "mm", "Nm", "cv", "kW", "hp", "count")
                                    .contains(Objects.toString(candidate.unit(), "count")),
                    "Unsupported canonical numeric unit");
            if ("NUMBER".equals(candidate.valueType())) {
                String dimension =
                        switch (Objects.toString(candidate.unit(), "")) {
                            case "kg" -> "mass";
                            case "L" -> "volume";
                            case "mm" -> "length";
                            case "Nm" -> "torque";
                            case "cv", "kW", "hp" -> "power";
                            case "" -> "count";
                            default -> "unsupported";
                        };
                require(
                        dimension.equals(Ontology.key(candidate.dimension())),
                        "Numeric dimension and canonical unit must agree");
                var number =
                        Ingestion.normalizeNumber(observation.rawValue(), observation.sourceUnit(), candidate.unit());
                if (dimension.equals("count"))
                    require(
                            number.signum() >= 0 && number.stripTrailingZeros().scale() <= 0,
                            "Counts must be nonnegative integers");
            }
            for (var existing :
                    jdbc.queryForList("SELECT code,label,description FROM catalog.attribute_definition", Map.of())) {
                require(
                        !Ontology.key(existing.get("code").toString()).equals(Ontology.key(candidate.proposedCode()))
                                && !Ontology.key(existing.get("label").toString())
                                        .equals(Ontology.key(candidate.label()))
                                && !Ontology.key(existing.get("description").toString())
                                        .equals(Ontology.key(candidate.definition())),
                        "A potentially duplicate meaning already exists; propose an alias or review semantics");
            }
            attribute = UUID.randomUUID();
            params.put("attributeId", attribute);
        } else if ("ADD_ALIAS".equals(candidate.kind())) {
            require(
                    !"DERIVED_TEXT".equals(observation.termOrigin()),
                    "Derived English labels cannot establish manufacturer terminology");
            var targets = jdbc.queryForList(
                    "SELECT * FROM catalog.attribute_definition WHERE code=:code",
                    Map.of("code", Objects.toString(candidate.attributeCode(), "")));
            require(targets.size() == 1, "Alias target must be an existing definition");
            var target = targets.getFirst();
            require(
                    Objects.equals(target.get("value_type"), candidate.valueType())
                            && Objects.equals(target.get("unit"), candidate.unit()),
                    "An alias cannot change an attribute type or unit");
            attribute = (UUID) target.get("id");
            params.put("attributeId", attribute);
        } else {
            require(
                    candidate.proposedCode() != null && candidate.proposedCode().matches("[A-Z][A-Z0-9_]{0,79}"),
                    "A canonical vocabulary code is required");
            require(
                    candidate.label() != null
                            && observation.rawValue().contains(candidate.label())
                            && observation.excerpt().contains(candidate.label()),
                    "New vocabulary alias requires an exact observed value");
            var targets = jdbc.queryForList(
                    "SELECT * FROM catalog.attribute_definition WHERE code=:code",
                    Map.of("code", Objects.toString(candidate.attributeCode(), "")));
            require(
                    targets.size() == 1 && targets.getFirst().get("value_type").equals("LIST"),
                    "Vocabulary extensions require an existing LIST attribute");
            attribute = (UUID) targets.getFirst().get("id");
            params.put("attributeId", attribute);
            var values = jdbc.queryForList(
                    "SELECT code,aliases FROM catalog.attribute_value WHERE attribute_id=:attributeId", params);
            require(!values.isEmpty(), "The target must already define a controlled vocabulary");
            for (var value : values) {
                var aliases = json.readValue(value.get("aliases").toString(), new TypeReference<List<String>>() {});
                require(
                        !List.of(Ontology.key(candidate.proposedCode()), Ontology.key(candidate.label()))
                                        .contains(Ontology.key(value.get("code").toString()))
                                && aliases.stream()
                                        .noneMatch(a -> List.of(
                                                        Ontology.key(candidate.proposedCode()),
                                                        Ontology.key(candidate.label()))
                                                .contains(Ontology.key(a))),
                        "Vocabulary value or alias already exists");
            }
        }
        // A scoped term may overlap a broader term, but may not redefine it.
        var overlapping = jdbc.queryForList(
                "SELECT attribute_id FROM catalog.manufacturer_term WHERE term_key=:term_key AND brand=:brand AND market=:market AND language=:language AND (model='' OR :model='' OR model=:model) AND (model_year=0 OR :model_year=0 OR model_year=:model_year)",
                params);
        require(
                candidate.kind().equals("EXTEND_VOCABULARY")
                        || overlapping.stream().allMatch(t -> attribute.equals(t.get("attribute_id"))),
                "Manufacturer term conflicts with an existing meaning");
        if (!candidate.kind().equals("EXTEND_VOCABULARY")) {
            var generic = jdbc.queryForList(
                    "SELECT attribute_id,term FROM catalog.attribute_alias UNION ALL SELECT id,label FROM catalog.attribute_definition UNION ALL SELECT id,code FROM catalog.attribute_definition",
                    Map.of());
            require(
                    generic.stream()
                            .filter(t -> Ontology.key(t.get("term").toString()).equals(row.get("term_key")))
                            .allMatch(t -> attribute.equals(t.get("attribute_id"))),
                    "Manufacturer term conflicts with a canonical or generic meaning");
        }
        jdbc.update("INSERT INTO catalog.ontology_revision(revision,reason) VALUES(:newRevision,:reason)", params);
        if ("ADD_ATTRIBUTE".equals(candidate.kind()))
            jdbc.update(
                    "INSERT INTO catalog.attribute_definition(id,code,label,description,value_type,unit) VALUES(:attributeId,:proposed_code,:label,:definition,:value_type,:unit)",
                    params);
        if (candidate.kind().equals("EXTEND_VOCABULARY")) {
            params.put("aliases", encode(List.of(candidate.label())));
            jdbc.update(
                    "INSERT INTO catalog.attribute_value(attribute_id,code,aliases,introduced_revision) VALUES(:attributeId,:proposed_code,CAST(:aliases AS jsonb),:newRevision)",
                    params);
        }
        if (!candidate.kind().equals("EXTEND_VOCABULARY") && !"DERIVED_TEXT".equals(observation.termOrigin())) {
            params.put("termId", UUID.randomUUID());
            jdbc.update("""
                    INSERT INTO catalog.manufacturer_term(id,attribute_id,term,term_key,brand,market,language,model,model_year,source_sha256,locator,introduced_revision)
                    VALUES(:termId,:attributeId,:term,:term_key,:brand,:market,:language,:model,:model_year,:sha,:locator,:newRevision) ON CONFLICT DO NOTHING
                    """, params);
        }
        jdbc.update(
                "UPDATE catalog.ontology_proposal SET status='ACTIVATED',activated_revision=:newRevision,reason=:reason,reviewed_by=:reviewer WHERE id=:id",
                params);
        jdbc.update("UPDATE ingestion.catalog_version SET revision=revision+1", Map.of());
        jdbc.update(
                "INSERT INTO ingestion.projection_event(revision,ontology_revision) VALUES(:revision,:ontology)",
                Map.of("revision", catalogRevision + 1, "ontology", revision + 1));
        return list();
    }
}
