# Vehicle image backfill

Backfilled on 2026-09-11: all seven local configurations and all five cloud
configurations have a primary image record in `catalog.vehicle_image`.
Shark GS and Territory Titanium currently exist only in the local catalog.

The seven original manufacturer files are stored under
`gs://fiap-challenge-ford-specsync-dev-vehicle-images/vehicles/primary/` in content-addressed
paths. This dedicated image bucket allows public reads; the original files bucket
retains enforced public-access prevention. Terraform owns both the new bucket
and its public-reader binding (imported into the dev state). PostgreSQL stores the object reference,
SHA-256, content type, byte size, dimensions, alt text, source URLs, capture time,
and applicability and rights notes. Image bytes are not stored in PostgreSQL.

`manifest.json` records every configuration and object. All images are marked
`ILLUSTRATIVE`: some manufacturer assets are MY2025, and exact trim/year
applicability is not established for the model-level images. The Hilux image
is a 368×176 model-page photograph; Toyota's selected MY2026 SRX Plus colorizer
uses a 31-frame sprite sheet, which is unsuitable as a standalone card image.
Manufacturer ownership is retained in the rights note; this backfill does not
claim a verified reuse license or commercial-use permission.

## Reproduce

Apply the checked-in Flyway migrations first, including
`apps/api/src/main/resources/db/migration/V14__vehicle_images.sql`. For local
PostgreSQL, use the existing Compose migration service:

```sh
docker compose --profile data-tools run --rm migrate
```

Download the exact `sourceUrl` files to a directory using each manifest `file`
name, or retrieve the existing bucket objects with
`gcloud storage cp`. Toyota's source was retrieved through the rendered official
page because direct page requests returned HTTP 403. Do not substitute different
bytes without updating and reviewing the manifest.

```sh
node tools/gcp/vehicle-images/backfill.mjs upload /path/to/images
node tools/gcp/vehicle-images/backfill.mjs sql > /tmp/vehicle-images.sql
docker compose exec -T postgres psql -U myuser -d mydatabase \
  -v ON_ERROR_STOP=1 < /tmp/vehicle-images.sql
```

The upload verifies the complete batch before writing and uses `--no-clobber`.
The SQL uses a transaction, matches UUID plus brand/model/trim/market/year, skips
configurations absent from the target database, and preserves existing primary
images. It does not create configurations or alter specifications.

For Cloud SQL, this run used temporary Cloud Run jobs on the existing
`specsync-dev` VPC and `specsync-dev-run` subnet, with the API service identity
and the database password supplied by Secret Manager. Flyway validated all 14
migrations before applying V14; the backfill then used `psql` with
`ON_ERROR_STOP`. No database password was copied into this repository.

## Verification and rendering

- Local: 7 configurations, 7 image records, 0 missing; rerun inserted 0 rows.
- Cloud: 5 configurations, 5 image records, 0 missing.
- All 7 uploaded objects were read back and matched their original SHA-256 and
  byte size.
- Flyway validated the existing history and applied V14 in both environments.

The API returns nullable `primaryImage` metadata on catalog search, specifications,
and comparisons. The AI tool schema preserves it in chat results. Angular displays
photos in catalog cards, lists, detail panes and comparison headers, with alt text,
illustrative labels, lazy loading and a fallback when absent or loading fails.
Historic chat results without image metadata remain valid. Catalog cards and
vehicle details reuse current photo metadata from their existing API lookup.
Comparisons have a separate, bounded media lookup for configurations missing a
photo. Only media is displayed from that lookup; recorded tool identities,
specifications, arguments and results are never replaced or persisted again.

URLs use `https://storage.googleapis.com/<bucket>/<object>` without expiring
credentials. Content-addressed objects have `public,max-age=31536000,immutable`
caching; replacements must receive a new hash/path.

For records imported before the dedicated public bucket existed, upload and
verify the public objects first, then run `backfill.mjs relocate` through the
same `psql` workflow. It updates only matching configuration/hash/object rows
still referencing the original files bucket and preserves subsequent replacements.
The relocation was applied to all seven local and five cloud image records.
All seven public URLs were verified without credentials against their SHA-256.

To repeat the HTTP smoke test against local development:

```sh
EXPECTED_VEHICLES=7 node tools/gcp/vehicle-images/verify.mjs
```

For the cloud API, set `API_BASE_URL` and run with `CLOUD_RUN_IDENTITY=true`
inside the VPC under the AI service identity, which already has API invoker
access. The verifier obtains an audience-scoped identity token from Cloud Run
metadata, uses it only for the API, and downloads the images without credentials.
It checks search, specification and comparison responses plus image checksums.

## Deployed release

The API, AI and web containers were deployed on 2026-09-11 with image tag
`vehicle-images-20260911`. Ready revisions:

- API: `specsync-dev-api-00024-6m6`
- AI: `specsync-dev-ai-00023-bfd`
- Web: `specsync-dev-web-00036-246`

The HTTP verifier passed for seven local and five cloud vehicles. Local browser
checks confirmed loaded photos in catalog cards, lists, detail panes and
comparison headers. The public app serves the new image renderer.
Angular's 340 tests, the API suite and the AI service's 382 tests passed, alongside
lint, architecture and type checks. Production container builds passed for all
three apps. The local aggregate verification reached the AI bundle step, which
refused to overwrite the active Mastra development server; the isolated production
container build verified that bundle instead. Temporary cloud database and smoke
test jobs were removed after completion.

## Rendering dimensions

The UI preserves proportions with centered `object-fit: cover`. Wide manufacturer
canvases no longer produce bands above and below the vehicle. Keep the entire
vehicle in the central 64% of a 2.5:1 source canvas for the 16:10 crop.

| View                 | Frame | CSS display size                | Minimum 2x image after cropping |
| -------------------- | ----- | ------------------------------- | ------------------------------- |
| Catalog card         | 16:10 | 224 × 140                       | 448 × 280                       |
| List thumbnail       | 16:10 | 80 × 50 mobile; 96 × 60 desktop | 192 × 120                       |
| Comparison thumbnail | 16:10 | 76.8 × 48                       | 154 × 96                        |
| Drawer photo         | 16:9  | up to 704 × 396                 | 1408 × 792                      |

The drawer photo is the header background, under a dark gradient and the vehicle
name. On narrow screens, a minimum 256px header leaves room for wrapping labels;
the photo itself retains 16:9. Missing/error states and photo-source attribution
remain available. No duplicate image section appears beneath the header.

Original files are served today (15–113KB), with lazy loading and intrinsic-size
metadata; `sizes` describes layout and does not create resized files. Prefer
masters at least 1920px wide and 900px high when sourcing replacements. Do not
upscale a thumbnail and call it a high-resolution source. The present Hilux
368 × 176 and Frontier 600 × 355 sources fall short of the drawer's 2x target;
layout fixes cannot recover detail absent from those originals. Content-addressed
replacements must retain attribution and get a new URL.

The layout/replay update is verified locally (343 unit tests, 65 architecture
tests, lint and production build). Browser checks include the saved Ranger
conversation that predates photo metadata. Cloud deployment of tag
`vehicle-image-layout-20260911` was blocked by automatic approval review before
execution and is pending explicit deployment approval; the release listed above
is still the deployed version.
