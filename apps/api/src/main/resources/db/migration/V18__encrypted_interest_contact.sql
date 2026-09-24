-- The contact link is personal data and is stored AES-256-GCM encrypted by the API
-- ("v1:" + Base64url(IV || ciphertext || tag)) once a field-encryption key is configured.
-- HTTPS validation stays in the use case; legacy plain-text rows remain valid until rewritten.
ALTER TABLE research.interest_profile DROP CONSTRAINT IF EXISTS interest_profile_contact_url_check;
ALTER TABLE research.interest_profile ADD CONSTRAINT interest_profile_contact_url_check
    CHECK (length(contact_url) <= 1000 AND (contact_url ~* '^https://' OR contact_url ~ '^v1:[A-Za-z0-9_-]+$'));
