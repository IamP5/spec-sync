package com.fiap.ford.specsync.domain.shared;

import java.time.Instant;

/**
 * Something that happened in the domain. Concrete events are immutable records, named in the past
 * tense, that implement the sealed {@code <Aggregate>Event} family of their aggregate.
 */
public interface DomainEvent {

    Instant occurredOn();
}
