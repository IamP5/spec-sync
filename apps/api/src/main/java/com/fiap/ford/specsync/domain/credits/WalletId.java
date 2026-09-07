package com.fiap.ford.specsync.domain.credits;

import com.fiap.ford.specsync.domain.exceptions.DomainException;
import com.fiap.ford.specsync.domain.shared.Identifier;
import com.fiap.ford.specsync.domain.validation.Error;

/**
 * Identity of a wallet: the end user's Firebase {@code uid}. The AI service is the only caller and
 * verifies the token before it reaches this API, so the value is trusted once the service key
 * matched; the invariants here only keep obviously wrong values out of the database.
 */
public record WalletId(String value) implements Identifier<String> {

    public static final int MAX_LENGTH = 128;

    public WalletId {
        if (value == null || value.isBlank() || value.length() > MAX_LENGTH) {
            throw DomainException.with(
                    new Error("uid", "'uid' is required and must contain at most %d characters".formatted(MAX_LENGTH)));
        }
    }

    public static WalletId from(final String value) {
        return new WalletId(value == null ? null : value.trim());
    }
}
