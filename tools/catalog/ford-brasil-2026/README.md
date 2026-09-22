# Ford Brasil current catalog import

This directory reproduces the Ford Brasil catalog captured on 2026-09-12.
The checked-in manifest contains 12 current product lines, 44 configurations,
71 catalog attribute definitions, official-source provenance, and two explicit
supersessions for obsolete local Ranger identities. Future-launch cards are not
included.

The source audit, document hashes, model-year decisions, editorial conflicts,
and official links are recorded in
`docs/research/ford-brasil-current-lineup-2026-09-12.md`. Image records preserve
their official asset and page URLs. Images linked by Ford to a version are
`EXACT_CONFIGURATION`; family imagery is `ILLUSTRATIVE`.

## Catalog data

Apply all Flyway migrations, then run the idempotent SQL generator against the
local PostgreSQL instance:

```sh
node tools/catalog/ford-brasil-2026/import.mjs sql \
  | docker compose exec -T postgres psql -U myuser -d mydatabase \
      -v ON_ERROR_STOP=1
```

The importer registers the dataset checksum in `catalog.seed_dataset`, so a
second run is a no-op. A changed manifest must receive a new dataset version.
After importing, refresh and compare the graph projection:

```sh
NX_DAEMON=false npm exec -- nx run ai:data-project
NX_DAEMON=false npm exec -- nx run ai:data-status
```

## Images

Download the exact 27 official assets, verify their checked-in byte metadata,
upload them to content-addressed public objects, and populate all 44 active Ford
configuration records:

```sh
node tools/catalog/ford-brasil-2026/images.mjs download /tmp/specsync-ford-images
node tools/catalog/ford-brasil-2026/images.mjs upload /tmp/specsync-ford-images
node tools/catalog/ford-brasil-2026/images.mjs sql \
  | docker compose exec -T postgres psql -U myuser -d mydatabase \
      -v ON_ERROR_STOP=1
node tools/catalog/ford-brasil-2026/images.mjs verify
```

`upload` rejects any local file whose size or SHA-256 differs from the checked-in
metadata. `verify` downloads every public object and checks its content type,
size, and SHA-256. The SQL matches the complete configuration identity and does
not create missing catalog entities.
