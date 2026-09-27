package com.fiap.ford.specsync.infrastructure.gateway.research;

import com.fiap.ford.specsync.domain.research.Research;
import com.fiap.ford.specsync.domain.research.ResearchInterestGateway;
import com.fiap.ford.specsync.infrastructure.configuration.FieldCipher;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class ResearchInterestJdbcGateway implements ResearchInterestGateway {
    private final NamedParameterJdbcTemplate jdbc;
    private final FieldCipher cipher;

    public ResearchInterestJdbcGateway(DataSource source, FieldCipher cipher) {
        jdbc = new NamedParameterJdbcTemplate(Objects.requireNonNull(source));
        this.cipher = Objects.requireNonNull(cipher);
    }

    /** The contact link is personal data: encrypted at rest and bound to its (scope, user) row. */
    private static String row(String scope, String uid) {
        return "research.interest_profile.contact_url|" + scope + "|" + uid;
    }

    private String scope(UUID requestId, String uid) {
        Research.requireIdentity(requestId, uid);
        var owned = jdbc.queryForList(
                "SELECT w.scope_key FROM research.request r JOIN research.work w ON w.run_id=r.work_id WHERE r.id=:id AND r.user_id=:uid",
                Map.of("id", requestId, "uid", uid),
                String.class);
        Research.require(!owned.isEmpty(), "Research request not found");
        return owned.getFirst();
    }

    @Override
    public Page list(UUID requestId, String uid) {
        var scope = scope(requestId, uid);
        var params = Map.of("scope", scope, "uid", uid);
        var people = jdbc.query(
                "SELECT user_id, display_name, contact_url, user_id=:uid AS is_you FROM research.interest_profile WHERE scope_key=:scope ORDER BY created_at, user_id LIMIT 101",
                params,
                (rs, row) -> new Person(
                        rs.getString("display_name"),
                        cipher.decrypt(rs.getString("contact_url"), row(scope, rs.getString("user_id"))),
                        rs.getBoolean("is_you")));
        var mine = jdbc.query(
                "SELECT display_name, contact_url FROM research.interest_profile WHERE scope_key=:scope AND user_id=:uid",
                params,
                (rs, row) -> new Person(
                        rs.getString("display_name"),
                        cipher.decrypt(rs.getString("contact_url"), row(scope, uid)),
                        true));
        return new Page(
                List.copyOf(people.subList(0, Math.min(people.size(), 100))),
                mine.isEmpty() ? null : mine.getFirst(),
                people.size() > 100);
    }

    @Override
    @Transactional
    public void save(UUID requestId, String uid, String name, String contactUrl) {
        var scope = scope(requestId, uid);
        jdbc.update(
                """
            INSERT INTO research.interest_profile(scope_key,user_id,display_name,contact_url)
            VALUES (:scope,:uid,:name,:contact)
            ON CONFLICT(scope_key,user_id) DO UPDATE SET display_name=:name,contact_url=:contact,updated_at=now()
            """,
                Map.of(
                        "scope",
                        scope,
                        "uid",
                        uid,
                        "name",
                        name,
                        "contact",
                        cipher.encrypt(contactUrl, row(scope, uid))));
    }

    @Override
    @Transactional
    public void remove(UUID requestId, String uid) {
        jdbc.update(
                "DELETE FROM research.interest_profile WHERE scope_key=:scope AND user_id=:uid",
                Map.of("scope", scope(requestId, uid), "uid", uid));
    }
}
