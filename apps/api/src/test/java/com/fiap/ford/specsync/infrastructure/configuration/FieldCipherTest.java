package com.fiap.ford.specsync.infrastructure.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Base64;
import org.junit.jupiter.api.Test;

class FieldCipherTest {
    private static final String KEY = Base64.getEncoder().encodeToString(new byte[32]);
    private static final String CONTACT = "https://www.linkedin.com/in/example";
    private static final String ROW = "research.interest_profile.contact_url|scope-1|uid-1";

    private final FieldCipher cipher = new FieldCipher(new FieldEncryptionProperties(KEY));

    @Test
    void storesOnlyCiphertextAndRoundTripsIt() {
        final var stored = cipher.encrypt(CONTACT, ROW);

        assertThat(stored).startsWith("v1:").doesNotContain("linkedin");
        assertThat(cipher.decrypt(stored, ROW)).isEqualTo(CONTACT);
    }

    @Test
    void usesAFreshIvForEveryWrite() {
        assertThat(cipher.encrypt(CONTACT, ROW)).isNotEqualTo(cipher.encrypt(CONTACT, ROW));
    }

    @Test
    void rejectsCiphertextMovedToAnotherRowOrTampered() {
        final var stored = cipher.encrypt(CONTACT, ROW);
        final var tampered = stored.substring(0, stored.length() - 2) + (stored.endsWith("A") ? "BB" : "AA");

        assertThatThrownBy(() -> cipher.decrypt(stored, "research.interest_profile.contact_url|scope-1|uid-2"))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> cipher.decrypt(tampered, ROW)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void readsLegacyPlainTextAndRefusesCiphertextWithoutAKey() {
        final var disabled = new FieldCipher(new FieldEncryptionProperties(""));

        assertThat(cipher.decrypt(CONTACT, ROW)).isEqualTo(CONTACT);
        assertThat(disabled.encrypt(CONTACT, ROW)).isEqualTo(CONTACT);
        assertThatThrownBy(() -> disabled.decrypt(cipher.encrypt(CONTACT, ROW), ROW))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsKeysThatAreNotAes256() {
        final var shortKey = Base64.getEncoder().encodeToString(new byte[16]);

        assertThatThrownBy(() -> new FieldEncryptionProperties(shortKey)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new FieldEncryptionProperties("not base64!"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
