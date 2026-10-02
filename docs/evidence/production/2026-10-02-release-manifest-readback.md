# Production release-manifest readback

**Produced:** 2026-10-02
**Owner:** Harrison Rubin
**Observed at:** 2026-10-02T17:45:04Z
**Intended source:** `4211b41da4e1235b87f9866d80ed2f40674e5952`

## Result

The live Vercel production host at `https://semester-shared-core.vercel.app/`
returned HTTP 200 for the Semester HTML, module asset and stylesheet asset.
The same host returned HTTP 404 for `/release.json`.

The GitHub Pages product host at
`https://harrisonjrubin7-cmyk.github.io/semester/` also returned HTTP 404 for
`/semester/release.json` when checked immediately before the Vercel run.

This is a failed production release-identity gate. It proves that neither live
host had deployed the current readiness branch, even though the branch's local
production build emitted a valid `release.json` with:

- source SHA `4211b41da4e1235b87f9866d80ed2f40674e5952`;
- environment `Production`;
- private beta off;
- the account service on;
- institutional preview off; and
- read-only mode off.

## Control added

`app/scripts/public-production-smoke.mjs` now reads the production manifest on
every hourly public smoke. It fails when the manifest is missing or malformed,
when its source SHA differs from the revision being monitored, or when the
deployed configuration is beta, demo, signed-out, or read-only. The workflow
passes its exact checkout SHA as `SEMESTER_EXPECTED_RELEASE_SHA`.

The gate remains open until an authorized merge and deployment put the
manifest on the intended production host and the same smoke passes there. A
local build is not substituted for that production readback.
