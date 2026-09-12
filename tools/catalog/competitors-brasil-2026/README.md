# Brazilian competitor catalog (2026)

This dataset captures the principal current Brazilian competitors for the Ford
lineup, including established manufacturers and newer Chinese brands.

## Scope

- 19 brands
- 41 models
- 176 configurations
- 61 distinct official manufacturer images
- 3 active GWM Poer configurations: `POER P30 Pro`, `POER P30 Trail`, and
  `POER P30 Exclusive`

`manifest.mjs` is the catalog source of truth. Every configuration includes
identity evidence from a captured official Brazilian manufacturer source.
`image-sources.mjs` maps each configuration to exactly one official image and
records whether the image is exact for the configuration or illustrative for
the current model family.

## Source capture

Capture the official pages and PDFs, then check the generated metadata into
`source-metadata.mjs`:

```sh
node tools/catalog/competitors-brasil-2026/capture-sources.mjs <source-directory>
```

The Toyota and Porsche asset endpoints reject ordinary automated downloads.
Their eight images were exported from the official manufacturer pages with the
browser page-assets exporter and are marked with `browserCaptured: true`.
Place those files in the image directory before running the download command.

## Validation and import

```sh
node tools/catalog/competitors-brasil-2026/import.mjs sql > /tmp/competitors.sql
node tools/catalog/competitors-brasil-2026/images.mjs validate
node tools/catalog/competitors-brasil-2026/images.mjs download <image-directory>
node tools/catalog/competitors-brasil-2026/images.mjs metadata <image-directory>
node tools/catalog/competitors-brasil-2026/images.mjs sql > /tmp/competitor-images.sql
node tools/catalog/competitors-brasil-2026/images.mjs upload <image-directory>
node tools/catalog/competitors-brasil-2026/images.mjs verify
```

Apply the catalog SQL before the image SQL. After PostgreSQL is current, run
the AI data-projection Nx target to rebuild the Neo4j read model. The graph
projection excludes superseded configurations while PostgreSQL retains them as
audit history.

The upload stores content-addressed objects in the public
`fiap-challenge-ford-specsync-dev-vehicle-images` bucket. The verification
command checks each public object's status, content type, byte length, and
SHA-256 digest.

Manufacturer ownership is retained in the image metadata. This dataset records
source attribution but does not assert an independent reuse license or
commercial-use permission.
