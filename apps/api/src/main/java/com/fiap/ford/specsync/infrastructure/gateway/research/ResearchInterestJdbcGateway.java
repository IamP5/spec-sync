package com.fiap.ford.specsync.infrastructure.gateway.research;

import com.fiap.ford.specsync.domain.research.Research;
import com.fiap.ford.specsync.domain.research.ResearchInterestGateway;
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

    public ResearchInterestJdbcGateway(DataSource source) {
        jdbc = new NamedParameterJdbcTemplate(Objects.requireNonNull(source));
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
        var params = Map.of("scope", scope(requestId, uid), "uid", uid);
        var people = jdbc.query(
                "SELECT display_name, contact_url, user_id=:uid AS is_you FROM research.interest_profile WHERE scope_key=:scope ORDER BY created_at, user_id LIMIT 101",
                params,
                (rs, row) ->
                        new Person(rs.getString("display_name"), rs.getString("contact_url"), rs.getBoolean("is_you")));
        var mine = jdbc.query(
                "SELECT display_name, contact_url FROM research.interest_profile WHERE scope_key=:scope AND user_id=:uid",
                params,
                (rs, row) -> new Person(rs.getString("display_name"), rs.getString("contact_url"), true));
        return new Page(
                List.copyOf(people.subList(0, Math.min(people.size(), 100))),
                mine.isEmpty() ? null : mine.getFirst(),
                people.size() > 100);
    }

    @Override
    @Transactional
    public void save(UUID requestId, String uid, String name, String contactUrl) {
        jdbc.update("""
            INSERT INTO research.interest_profile(scope_key,user_id,display_name,contact_url)
            VALUES (:scope,:uid,:name,:contact)
            ON CONFLICT(scope_key,user_id) DO UPDATE SET display_name=:name,contact_url=:contact,updated_at=now()
            """, Map.of("scope", scope(requestId, uid), "uid", uid, "name", name, "contact", contactUrl));
    }

    @Override
    @Transactional
    public void remove(UUID requestId, String uid) {
        jdbc.update(
                "DELETE FROM research.interest_profile WHERE scope_key=:scope AND user_id=:uid",
                Map.of("scope", scope(requestId, uid), "uid", uid));
    }
}
