package com.fiap.ford.specsync.domain.shared;

import java.util.List;

/**
 * Root of an aggregate: the only object a gateway loads and saves. Instances are created through
 * static factories ({@code newX(...)} for brand-new aggregates, {@code with(...)} to rehydrate).
 */
public abstract class AggregateRoot<ID extends Identifier<?>> extends Entity<ID> {

    protected AggregateRoot(final ID id) {
        this(id, List.of());
    }

    protected AggregateRoot(final ID id, final List<DomainEvent> domainEvents) {
        super(id, domainEvents);
    }
}
