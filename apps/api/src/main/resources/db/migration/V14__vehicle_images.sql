-- Primary vehicle photographs live in object storage; catalog rows retain provenance.
CREATE TABLE catalog.vehicle_image (
    configuration_id uuid PRIMARY KEY REFERENCES catalog.vehicle_configuration(id),
    storage_bucket text NOT NULL CHECK (btrim(storage_bucket) <> ''),
    storage_object text NOT NULL CHECK (btrim(storage_object) <> ''),
    sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
    byte_size bigint NOT NULL CHECK (byte_size > 0),
    width integer NOT NULL CHECK (width > 0),
    height integer NOT NULL CHECK (height > 0),
    alt_text text NOT NULL CHECK (btrim(alt_text) <> ''),
    source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
    source_page_url text NOT NULL CHECK (source_page_url LIKE 'https://%'),
    match_scope text NOT NULL CHECK (match_scope IN ('EXACT_CONFIGURATION', 'ILLUSTRATIVE')),
    match_note text NOT NULL CHECK (btrim(match_note) <> ''),
    rights_note text NOT NULL CHECK (btrim(rights_note) <> ''),
    captured_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
