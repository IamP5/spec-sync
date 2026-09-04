package com.fiap.ford.specsync.domain.validation;

/** One violated invariant: which property failed and the human-readable reason. */
public record Error(String property, String message) {}
