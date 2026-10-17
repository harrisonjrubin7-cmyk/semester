# Community guidelines release evidence

Reviewed 2026-10-16. Pull request: https://github.com/harrisonjrubin7-cmyk/semester/pull/1607.

## Implemented and verified

H-014 product guidance is connected to the existing Community screen in
signed-out, disabled and member states. It uses the report form's category
labels and the shared emergency notice. Opening it reads and writes no
account data. This does not publish the legal guidelines draft or activate
Community participation.

Local verification passed 524 Community/help tests, 126 isolation/developer
documentation tests, 62 operator tests, 9 token tests and 70 design contracts.
Lint, the app production build and university typecheck passed. Chrome checks
at 390px and 1280px confirmed Enter opens the disclosure, no horizontal
overflow and no page errors.

Hosted checks on `29edd2512101bc0effcc1aca20baa5b587573cee` passed the default,
timezone and shuffled test suites, build, database policies, account sync,
secret scanning and CodeQL. The complete CI job failed at performance budgets;
later browser, load and deployment rehearsals were skipped.

## Open security findings

HawkScan completed its frontend Ajax and active scans, discovering 63 URLs.
Scan: https://app.stackhawk.com/scans/b77a6e54-2c6b-496a-8c06-22a6fa2916e9.
Check: https://github.com/harrisonjrubin7-cmyk/semester/pull/1607/checks?check_run_id=117078630574.
The job's exit status was successful but its results were not finding-free:

- Two NEW medium paths: `GET /` and `GET /index.html`, both
  `CSP: style-src unsafe-inline`.
- Three paths for the same finding were already marked Risk Accepted in
  StackHawk. Their triage was not changed.
- The scan covers the public frontend, not authenticated institutional
  operations or the separate Supabase API. CLI route/metrics inspection was
  unavailable locally, so no complete route-coverage claim is made.

`app/src/lib/csp.test.ts` documents and tests the current rendering dependency:
Mermaid injects an SVG style element, and the SVG renderer uses style
attributes. Simply removing the allowance would break generated figures.
Moving the same unrestricted allowance to another CSP directive would not
remediate the underlying issue. No finding was suppressed or accepted by
this change.

Required follow-through: migrate generated diagram styling to a restrictive
policy while preserving diagram rendering; align the HTML meta policy and
host headers; verify rendering and CSP enforcement in browsers; then rescan
the original finding paths. This release remains open pending remediation.

## Open performance gate

The CI build measured these incremental route gzip sizes against the existing
budgets:

| Route | Measured | Budget |
| --- | ---: | ---: |
| Export | 75.1 KiB | 69.0 KiB |
| Console | 42.2 KiB | 41.0 KiB |
| Degree | 41.3 KiB | 41.0 KiB |
| Recovery | 72.2 KiB | 62.0 KiB |

First load passed at 473.0 KiB of 479.0 KiB. The Community route was within
budget. Current-main commit `8226231706aa5686d4d298757d61f7385cd9cf28`
also had a failed build check; this branch repaired its stale operator
coverage reports and duplicate isolation-list entries, but has not resolved
the route-size gate. Budgets were not raised.

Required follow-through: attribute the route closure growth and reduce eager
dependencies, then rerun performance and downstream CI gates. No production
merge or deployment of this PR is claimed here.

## Continuation on 2026-10-17

Reconciled main `03345c0b840c7a848b47e858d2f0b099cbdb3e11` into the
branch at `74c3863c747a031814feaccac0c0642ce08108f1`. The local production
build and current-main performance budgets passed. Main had independently
updated the budgets; this continuation did not raise them. Export remained
76,892 bytes and Recovery 73,900 bytes, so this is not a size reduction claim.
The focused Community, Recovery, CSP, host-header and isolation run passed
76 tests.

The hosted integration build tested merge ref
`fe46d54ecdbe9459c782af3d55db65044eb12883` and passed 24,447 tests, with
three failures: the new evidence document was unregistered, the office-action
fixture's October 15 deadline had elapsed, and billing-portal's deployment
snapshot still said pending. The evidence entry is now registered without
promoting any readiness claim. The office-action test pins the calendar and
uses an independent elapsed-time clock for bounded waits. A read-only
Management API observation found billing-portal ACTIVE, version 340, updated
2026-10-17T15:22:22.298Z, with a platform entrypoint. The snapshot records
that observation, not a payment acceptance result. All 36 tests in those
three affected files passed after the corrections.

HawkScan on that integration ref discovered 63 URLs (203 Ajax results), and
still reported the same two NEW medium CSP paths. Scan:
https://app.stackhawk.com/scans/6fc1ebe8-c6ef-48ce-8b94-6c3c52cce27d.
The successful scanner job does not clear these findings or establish
authenticated/backend coverage. Security remediation and final hosted
validation remain open; no production promotion is claimed.
