package com.fiap.ford.specsync.domain.shared;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.validation.Error;

/**
 * Invariant checks shared by entities and value objects. Every failure raises a {@link
 * DomainException} carrying the offending property, so the web layer can turn it into a 422.
 */
public interface AssertionConcern {

    default void assertArgumentNotNull(final Object value, final String property, final String message) {
        if (value == null) {
            throw DomainException.with(new Error(property, message));
        }
    }

    default void assertArgumentNotEmpty(final String value, final String property, final String message) {
        if (value == null || value.isBlank()) {
            throw DomainException.with(new Error(property, message));
        }
    }

    default void assertArgumentMaxLength(
            final String value, final int maxLength, final String property, final String message) {
        if (value != null && value.length() > maxLength) {
            throw DomainException.with(new Error(property, message));
        }
    }

    default void assertConditionTrue(final boolean condition, final String property, final String message) {
        if (!condition) {
            throw DomainException.with(new Error(property, message));
        }
    }
}
