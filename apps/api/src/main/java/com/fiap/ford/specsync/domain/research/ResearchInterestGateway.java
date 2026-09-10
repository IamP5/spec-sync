package com.fiap.ford.specsync.domain.research;

import java.util.List;
import java.util.UUID;

/** Participation is explicit and scoped to the shared research, never inferred from followers. */
public interface ResearchInterestGateway {
    record Person(String name, String contactUrl, boolean isYou) {}

    record Page(List<Person> people, Person mine, boolean hasMore) {}

    Page list(UUID requestId, String uid);

    void save(UUID requestId, String uid, String name, String contactUrl);

    void remove(UUID requestId, String uid);
}
