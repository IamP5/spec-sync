package com.fiap.ford.specsync.infrastructure.configuration;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Objects;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * AES-256-GCM encryption of individual columns. Stored form: {@code v1:} + Base64url(IV || ciphertext
 * || tag). The caller's context (e.g. the row key) is authenticated as AAD, so a ciphertext copied to
 * another row fails to decrypt. Values without the prefix are legacy plain text and are returned
 * as-is, which lets existing rows migrate on their next write.
 */
public final class FieldCipher {

    private static final String PREFIX = "v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKey key;
    private final SecureRandom random = new SecureRandom();

    public FieldCipher(final FieldEncryptionProperties properties) {
        Objects.requireNonNull(properties);
        this.key = properties.enabled() ? new SecretKeySpec(properties.bytes(), "AES") : null;
    }

    public String encrypt(final String plain, final String context) {
        if (key == null) {
            return plain;
        }
        try {
            final var iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            final var cipher = cipher(Cipher.ENCRYPT_MODE, iv, context);
            final var sealed = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            final var stored = ByteBuffer.allocate(IV_BYTES + sealed.length)
                    .put(iv)
                    .put(sealed)
                    .array();
            return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(stored);
        } catch (GeneralSecurityException failure) {
            throw new IllegalStateException("Field encryption failed", failure);
        }
    }

    public String decrypt(final String stored, final String context) {
        if (stored == null || !stored.startsWith(PREFIX)) {
            return stored;
        }
        if (key == null) {
            throw new IllegalStateException("Encrypted field found but no field-encryption key is configured");
        }
        try {
            final var bytes = Base64.getUrlDecoder().decode(stored.substring(PREFIX.length()));
            final var cipher = cipher(Cipher.DECRYPT_MODE, java.util.Arrays.copyOf(bytes, IV_BYTES), context);
            final var plain = cipher.doFinal(bytes, IV_BYTES, bytes.length - IV_BYTES);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException | ArrayIndexOutOfBoundsException failure) {
            // Tampered, truncated or moved ciphertext: never return partial or guessed data.
            throw new IllegalStateException("Field decryption failed", failure);
        }
    }

    private Cipher cipher(final int mode, final byte[] iv, final String context) throws GeneralSecurityException {
        final var cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, key, new GCMParameterSpec(TAG_BITS, iv));
        cipher.updateAAD(context.getBytes(StandardCharsets.UTF_8));
        return cipher;
    }
}
