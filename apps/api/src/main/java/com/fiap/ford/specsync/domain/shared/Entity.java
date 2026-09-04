package com.fiap.ford.specsync.domain.shared;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Base class for entities: identity-based equality plus the list of domain events registered
 * while the entity changed. Gateways drain {@link #domainEvents()} when they persist the aggregate.
 */
public abstract class Entity<ID extends Identifier<?>> implements AssertionConcern {

    private final ID id;
    private final List<DomainEvent> domainEvents;

    protected Entity(final ID id, final List<DomainEvent> domainEvents) {
        assertArgumentNotNull(id, "id", "'id' should not be null");
        this.id = id;
        this.domainEvents = new ArrayList<>(domainEvents == null ? List.of() : domainEvents);
    }

    public ID id() {
        return id;
    }

    public List<DomainEvent> domainEvents() {
        return Collections.unmodifiableList(domainEvents);
    }

    protected void registerEvent(final DomainEvent event) {
        if (event != null) {
            domainEvents.add(event);
        }
    }

    @Override
    public boolean equals(final Object other) {
        if (this == other) {
            return true;
        }
        if (other == null || getClass() != other.getClass()) {
            return false;
        }
        final var entity = (Entity<?>) other;
        return id.equals(entity.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
