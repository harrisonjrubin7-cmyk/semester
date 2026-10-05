# Screenshot readiness review — 1 October 2026

Scope: the seven screenshots supplied on 1 October, compared with commit
`46ee2414a2def0a87b23a3611cb771b2f94fade1` and the production Supabase project
used by `app/.env.production`. Screenshots are claims to investigate, not
evidence that a feature is missing or operational.

## Production observations

- Public frontend HTML, its module and stylesheet, and Supabase PostgREST
  answered successfully (`npm run smoke:public-production`). This proves
  reachability, not authenticated user journeys or institutional readiness.
- Production has 317 public tables; all have row-level security enabled.
  This is a schema observation, not a replacement for tenant-policy tests.
- `export_my_data()` and `erase_account(target uuid)` exist in production.
  `delete-account` is active. No real user's account was exported or deleted
  during this review; production end-to-end validation remains owed.
- Google Auth is disabled. Email, Apple and Microsoft Auth are configured.
  Provider configuration does not prove a successful sign-in.
- Production functions include the assistant, Canvas, LTI, integration tick,
  trust room, deletion, and billing checkout/webhook/cancellation. Function
  deployment does not prove institution-specific activation or live payments.

## Screenshot disposition

| Screenshot area | Repository / production basis | What remains before green |
| --- | --- | --- |
| Google sign-in | Auth settings explicitly report disabled | Register the real OAuth client and redirect URLs, configure credentials, then verify sign-in |
| Google, Microsoft, Zoom data connections | Connection code in `app/src/lib/connect.ts`; no customer integration exercised here | Provider client registrations, production proxy/configuration and consent/sync/revocation tests |
| School SSO and official data | SSO policy tables and institutional gateway exist | A named institution's IdP metadata, approved scopes, tenant configuration and successful UAT |
| Paid plans beyond Plus | Plan definitions and billing functions exist | Approved commercial offering, real processor prices/keys and checkout/webhook/refund validation; test checkout is not live payment evidence |
| Full account export and deletion | Production RPCs and deletion endpoint exist | Authenticated end-to-end check with a designated test account, including files and deletion receipt |
| External accessibility audit | `docs/accessibility/AT-PASS-PROTOCOL.md` | Human assistive-technology evaluation and an external assessment |
| Department admin, cohort publishing | Role and publication code exists | Run with an actual sponsor and approved cohort; capture UAT |
| Sponsor and data scope | Pilot agreement outline exists | Named sponsor and mutually approved scope |
| Counsel-reviewed order form | Contract outlines exist | Counsel review and executed agreement |
| Staff training | Role-specific guides and first-day checklists under `docs/launch/`; indexed and structurally checked by `app/src/lib/launch/content.test.ts` | Deliver the prepared training to the named pilot staff and record the institution's sign-off |
| Pilot measures and baseline | `docs/launch/PILOT-MEASURES-BASELINE-WORKSHEET.md` provides the scope, source, baseline, threshold and decision record | Agree the prepared measures with the sponsor and collect a real baseline |
| SAML SSO / SCIM | Institutional source and tests | Institution-specific identity/provisioning/deprovisioning verification |
| Canvas LTI 1.3 | Active `lti` function | Real platform registration, keys, deployment IDs and launch/role/deep-link UAT |
| Tenant isolation | RLS enabled on all production public tables | Keep the SQL policy suites green and produce named-tenant isolation evidence |
| DPA and written SLA | `docs/trust/DPA-CHECKLIST.md`, `SLA.md` | Legal/business approval and execution; drafts are not commitments |
| HECVAT | `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md` | Company-supplied answers, review and mapping into the institution's actual workbook |
| VPAT / ACR | Assessment protocol and procurement plan exist | Complete evaluation and a reviewed, versioned ACR; automated checks alone cannot support one |
| IdP test and UAT sign-off | Test mechanisms exist | Customer IdP access and customer's actual sign-off |
| Production restore and named alert recipient | Logical rehearsal evidence exists | Restore an actual backup into a nonproduction project; verify contents/timing; configure and exercise alerts to a named operator |
| Public-site/student-app accessibility | Automated regression coverage exists | Manual screen-reader pass, keyboard/zoom review and resolution of findings |
| Colour contrast | Existing automated sweep | Run against the deployed build; review images and non-text content separately |
| Ask Semester streaming and citations | `app/src/ai/streamlive.shape.test.ts` already guards polite completed-turn announcements and hidden token streams | Browser-level and human AT evaluation of actual streamed/cited answers; do not claim untested code is conformance |
| Course Studio authoring | Capability register lists scoped institutional work | Complete and validate the instructor-authoring release with its institution and accessibility evaluation |
| Assessment, timing, accommodations | Scoped assessment modules exist | Institutional assessment release and keyboard/accommodation/extension validation |
| Maintenance notices | New `app/scripts/maintenance.ts` validates windows and generates incident JSON plus Atom subscriber feed | Review institution-specific registration/finals exclusions; publish a real schedule only when maintenance is actually agreed; email delivery is not provided by Atom |
| Customer notifications | Governance notice records and incident process exist; the public form now records a request for manual setup without claiming that submission activates a subscription | Configure self-service preferences and confirmed email delivery; add named customer contacts and perform a designated delivery drill |
| Timed rollback | `ROLLBACK.md` documents the mechanism and deployment timings | Conduct and record an actual rollback exercise; normal deploy timings are not a rollback drill |
| Independent status hosting | The company-site status view is live on Vercel while the product status page is live on GitHub Pages; both were reached directly on 1 October | Keep both providers and checks operational; the incident file/history still comes from GitHub, and neither surface substitutes for a production restore |
| Native LMS and migration | Module/capability registers contain remaining work | Complete contracted course/submission/gradebook/assessment paths and rehearsed migration with reconciliation and rollback |
| Load and disaster recovery | Rehearsal and test mechanisms exist | Representative production-scale load evidence and a real backup recovery exercise |
| 24/7 on-call | `ROLLBACK.md` identifies a single responder | Staff a rota with more than one qualified responder and exercise escalation |
| Enterprise SLA and migration plan | Drafts and rollout materials exist | Approve service commitments, sign contract and agree/run migration with the customer |
| SOC 2 | Readiness program documented | Independent auditor's report for the defined system and period |
| ISO 27001 | No certification evidence supplied | Accredited certification process and actual certificate |
| WCAG 2.2 AA | Design/test target | Complete applicable evaluation and remediation before asserting conformance |
| FERPA controls | Control and consent-workflow code/documentation | Verify contractual and operational controls for the named institution; do not invent a FERPA certification |

## Changes made in this review

The publication tests used a relative path to another session's scratch
exports. A clean checkout with PDF tools installed therefore failed three
tests. Publication verification now runs automatically when the external
directory exists; an explicit `SEMESTER_PUBLICATION_DIR` remains mandatory
and fails if the directory or required tools are missing. Existing artifact
hash, PDF-content and DOCX-structure checks remain intact. Skipping absent
external artifacts is not a claim that the publication was verified.

The maintenance scheduler accepts a JSON plan with `id`, `title`, `from`,
`until`, `components`, optional `screens`, `affects`, `still`, and a reviewed
`protectedWindows` array of `{name, from, until}`. All times use
`YYYY-MM-DDTHH:mm:ssZ`. Run from `app/`:

```sh
node scripts/maintenance.ts /absolute/path/to/reviewed-plan.json
```

It rejects invalid/past/reversed times, duplicate IDs, protected-window
overlaps, unsupported screen names and missing impact wording, then prepares the incident list and
matching subscriber feed for review and deployment together. It sends no
email. Scheduled notices expire at their end; previously the recorded-file
reader discarded that end, leaving maintenance banners open indefinitely.

## Verification and limitations

- Baseline build, gateway typecheck and lint passed. Lint retains its existing
  allowed warnings; they were not relabeled as zero warnings.
- Baseline suite: 19,297 passed, 48 skipped, 3 publication-artifact failures.
- After publication fix: 19,300 passed, 51 skipped; no failures. Three skips
  are the unavailable exported publication, not product tests.
- Maintenance/status/publication targeted checks after review: 47 passed.
- Final shuffled suite: 19,304 passed, 51 skipped; no failures. Production
  build and lint passed again after the maintenance implementation.
- Explicit missing publication directory produced a nonzero exit as required.
- Maintenance regression test failed before the implementation existed.
- The expiration test also failed against a faithful revert. Review follow-up
  tests failed on misspelled screens and scheduled records lacking a valid
  maintenance window, then passed with both validations restored.
- Headless browser verification could not run: Chromium was absent, and its
  download returned an invalid archive. No browser accessibility, screen-reader
  or WCAG result is claimed for this review.

**Overall institutional/enterprise verdict: NO-GO until the unmet production,
customer and external evidence above is produced.** A green badge must follow
the evidence, not substitute for it. No certificate, signed agreement,
customer UAT, payment or real backup recovery was fabricated by this review.
