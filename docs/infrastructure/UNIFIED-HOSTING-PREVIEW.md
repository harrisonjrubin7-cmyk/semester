# Unified `semesterintel.tech` hosting preview

Status: draft and synthetic-preview candidate only  
Recorded: 10 October 2026  
Supersedes the routing target and unchecked cutover procedure in
[`VERCEL-CONSOLIDATION.md`](VERCEL-CONSOLIDATION.md). It does not authorize a
domain move, production deployment, database change or account migration.

## Candidate routing

The root Vercel Services project is the candidate. Route order is part of the
contract because a company-site catch-all placed earlier would swallow the
application, API or lab.

| Request | Candidate service |
| --- | --- |
| `semester.website/*` | `company-site`, unchanged |
| `/api`, `/api/*`, `/api/institution/*`, `/api/productivity/*` | root institution/productivity `api` service |
| `/lab`, `/lab/*` | `workflow-lab` |
| `/app` | permanent redirect to `/app/` |
| `/app/`, `/app/*` | Vite `app`, built with base `/app/` |
| `/`, all other paths on the candidate host | `company-site` |

The protected operations UI remains an application hash route at
`/app/#/console`. This plan does not treat the separate public FastAPI Course
Engine as the root API and does not change any Course Engine, LTI or operations
readiness file.

Company CTAs choose `/app/` only when the page is already running on
`semesterintel.tech` or `www.semesterintel.tech`. On `semester.website` they
retain the existing GitHub Pages application destination. This keeps the
separate company site operating until an independently approved cutover.

## Current metadata, not a cutover claim

Read through the connected Vercel account on 10 October 2026:

- Team `harrison22` owns the `semester`, `semester-company-site` and
  `semester-shared-core` projects.
- `semester` uses the Services preset. Its most recent preview deployment was
  `ERROR`; it has only Vercel aliases and no custom domain.
- `semester-shared-core` still owns `semesterintel.tech` and
  `www.semesterintel.tech`; its latest recorded production deployment is
  `READY`.
- The team domain inventory now includes both `semesterintel.tech` and
  `semester.website`. Project metadata did not show `semester.website` attached
  to any of the three projects above, so its serving project still needs to be
  identified before any future change.
- Direct public probes from the executor and browser fetch service were blocked
  with 403/tool errors. No fresh runtime response claim is made from those
  attempts.

## Data continuity hold

The canonical Supabase project `lzrqvlugnawcgywkhqlz` and prototype project
`kpuulmnicidgdmwgfngv` are separate lineages. The prototype was previously
measured with four accounts and one saved-state row. Their real-user status is unknown.
Preserve both projects exactly as they are.

An origin-preserving domain move can still switch backend lineage because the
new bundle may point to the canonical project. Before cutover, an owner must
make and record one concrete choice for every prototype account and saved row:
retain only, deliberately port with consent and reconciliation, or document it
as synthetic. Merely moving the domain is not a migration.

This preview performs no localStorage or IndexedDB reset, account deletion,
database switch, data copy, credential change, OAuth callback change or
permission change.

## Installed-app and PWA limits

The company page on the candidate host shows an explicit installed-app and
account-service prompt. It asks users to keep the earlier root installation
until they have signed in at `/app/` and checked their account, saved work and
offline files. There is no automatic redirect or automatic migration.

This candidate does **not** ship the experimental root-worker bridge. The app
registers its manifest and worker under `/app/`; the manifest remains relative
and therefore resolves its start URL, identity, shortcuts, share target, file
handlers and protocol handler within that scope.

Cache cleanup is intentionally narrow:

- only exact versioned Semester cache names for `/app/` and `/semester/` are
  eligible;
- a worker cleans only an older cache for its own supported scope;
- root-scoped legacy caches, the shared-file handover, unsupported nested
  scopes and unrelated origin caches are preserved;
- scope tokens use percent encoding, so arbitrary nested paths do not collide
  after punctuation flattening.

Known blockers remain: production-grade legacy takeover; real multipart share
consumption; CSP validation for the final response path; installed manifest
identity update behavior; PDF/ICS `launchQueue`; `web+semester` operating-system
dispatch; real share sheets; push-subscription retirement and notification
continuity; and iOS/Safari behavior. The earlier bridge's intermittent browser
results do not satisfy these gates.

## Evidence required before any cutover request

1. Build the exact candidate head in hosted CI and retain all required job
   results.
2. Use a safe, non-production preview and probe the route table above, response
   headers, application asset URLs, manifest, worker, API and lab.
3. Run browser checks at the exact preview head: load and hash navigation,
   `/app/#/console` protection, reload, offline relaunch, cache isolation,
   storage preservation and the installed-app prompt.
4. Obtain independent review of the exact head and resolve every blocking
   finding.
5. Record the data-continuity decision, OAuth callback readiness, environment
   lineage and rollback target.
6. Ask for a new explicit approval before merging or changing any live domain.

Synthetic preview success would prove only the candidate artifact and route
configuration. It would not prove real account continuity, real share targets,
push behavior, iOS installation, production secrets, domain ownership transfer
or operational readiness.
