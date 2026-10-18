# Semester ecosystem coverage matrix (stream level)

Source of truth: `docs/handoff/execute/00-INDEX.md`, which defines streams 00–13. The repository has no
`25-completion-program.md` or `30-phased-build.md`, so streams 14–29 have no source file here and their rows are
**unverified**: they describe what was not audited, not what the handoff requires. Status is what the **repository**
shows on `claude/quirky-meitner-4z1ida` at `bcdd2b58`.

Status vocabulary: **proposed** (spec only), **specified** (spec in repo), **in progress**,
**blocked**, **implemented** (code present), **verified** (acceptance gates run with evidence),
**deployed** (live in an environment). Nothing here is above *implemented* unless stated.

| Stream | Scope (handoff) | Repo evidence on this branch | Status | Blockers / next |
| --- | --- | --- | --- | --- |
| 00 | Repo audit, design-system sync | `docs/execute/00-setup-report.md` (self-reported) | in progress | Founder approval of design-system baseline |
| 01 | Database, tenancy, RLS, core logic | `docs/execute/01-platform-core-report.md`; 235 files in `supabase/migrations/` (file count only) | in progress | Migrations not applied to any hosted DB in this session |
| 01b | semester-core: consequence / freshness / approvals | `app/src/lib/core/` (this PR), 17 tests pass, `tsc` and lint clean | **verified (unit)** | No UI consumer yet |
| 01c | semester-core: provenance / nextaction | repo has `provenance.ts`, handoff conflicts | proposed | Reconcile names with repo `provenance.ts` |
| 01d | semester-core: access | would duplicate role/capability model | **blocked by design rule** | Must map onto `has_capability`, not a second core |
| 01e | semester-core: aigateway / scoring / pilot | gateway exists in `app/src/ai`; pilot tests exist | proposed | Reconcile with live gateway |
| 02 | Identity, SAML SSO, onboarding | `docs/execute/02-identity-sso-diff.md` only, no report | in progress | Staging IdP test login needed |
| 03 | Student OS | screens exist under `app/src/screens` (159 files); no stream report | proposed (audit needed) | Acceptance gates not run |
| 04 | Faculty, TA, advisor, registrar, finance, affairs | no stream report | proposed (audit needed) | Two-person approvals need the new `approvals.ts` wired to a UI |
| 05 | Institution console, integrations, migration | `app/server/`, `packages/institution`; no stream report | proposed (audit needed) | Reconciliation gate |
| 06 | Governed AI gateway | `app/src/ai`, `app/server`; no stream report | proposed (audit needed) | ai-redteam suite not run |
| 07 | Community, career, family, developer platform | `app/src/community`, career screens; no stream report | proposed (audit needed) | — |
| 08 | Ops command center | `app/src/components/console`, `app/src/lib/ops` (duty text + evidence) | proposed (audit needed) | `/ops` must not read student tables; untested here |
| 09 | Security, privacy, a11y, compliance | `SECURITY.md`, `app/src/a11y`; no stream report | proposed (audit needed) | Restore drill and axe on pilot routes not run |
| 10 | Pilot launch | `PILOT.md`, `BETA_EXIT_CRITERIA.md` exist | blocked | Human-only: DPA, insurance, HECVAT, SSO accounts |
| 11 | Public site, GTM | `company-site/` | proposed (audit needed) | Claims need sourcing |
| 12 | One place | not audited | proposed | — |
| 13 | Platform maturity | not audited | proposed | — |
| 14–17 | Native platform, finance, ops, web-to-app | not started; native clients not confirmed as required | proposed | Confirm whether native clients are in scope before any work |
| 18 | Role-system reconciliation | `handoff/role-reconcile.sh` not yet run | proposed | Must precede any new role table |
| 19–24 | Academic records, social, work studio, FERPA, collab, shell | not audited | proposed | — |
| 25 | Completion program (18 packages, status stages) | not audited | proposed | Gates the other streams' "done" |
| 26–29 | Faculty OS, executive OS, career/interview, identity/mail | not audited | proposed | — |

## Deployment

No environment has been deployed by this session.

- Vercel connector: `list_teams` returned no teams, so no project or preview target is reachable.
- `vercel.json` defines an `api` service rooted at `app/`; there is no local `.vercel` link.
- The handoff forbids production deploys, remote migrations and secret changes without explicit approval.

## Counts (what was actually measured)

- Migrations on disk: 235 SQL files (`supabase/migrations/`). Not a claim about applied state.
- Screen files: 159 under `app/src/screens/`. Not checked against the 281-route prototype inventory.
- Full unit suite on this branch: 24,197 passing, 2 failing (both pre-existing or unrelated to this change; see `docs/execute/semester-core-port-report.md`).
