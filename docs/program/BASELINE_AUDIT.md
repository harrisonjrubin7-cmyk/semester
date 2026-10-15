# Baseline audit (Phase 0 synthesis)

| | |
| --- | --- |
| Purpose | One page that says what the repository is, how big it is, what the Phase 0 audits found, and which of the repository's own documents prove something versus only assert it. It rolls up; it does not re-audit. |
| Scope | The whole tracked tree at `/home/user/semester`, branch `claude/confident-allen-3vivus`, based on `origin/main` `4adb8cc` (`origin/main` has since moved to `c170dcd`; this document does not cover those later merges). |
| Method | Synthesis of the completed Phase 0 outputs (listed in section 1) plus spot-verification of every number reused, by the commands shown in the tables. Nothing was run against production, no test suite or `*.check.sql` was executed, and no workflow was triggered. |
| Date | 2026-10-04 |
| Status | Phase 0 baseline — evidence-cited, not a readiness claim |

CLAUDE.md asks that `origin/main` be checked for the thing itself first. `git fetch origin main; git log --oneline -15 origin/main` showed no baseline-audit, current-state, target-state, C4 or assumption-register document on main; `git ls-tree -r --name-only origin/main | grep -E "docs/program/|docs/architecture/c4|BASELINE_AUDIT|ARCHITECTURE_(CURRENT|TARGET)|ASSUMPTION"` listed only `docs/program/0*-*.md`, `README.md`, `PHASE_0_1_RECONCILIATION.md` and the two `STATUS-2026-10-04*.md` files.

## 1. Inputs and how they are used

| Input | Path | Used for |
| --- | --- | --- |
| Risk register (R-001..R-036) | `docs/program/RISK_REGISTER.md` | Headline findings; IDs reused unchanged |
| Capability traceability matrix (105 rows) | `docs/program/CAPABILITY_TRACEABILITY_MATRIX.md` | Classification roll-up |
| Domain ownership matrix (14 domains) | `docs/program/DOMAIN_OWNERSHIP_MATRIX.md` | Domain scope, single-seat ownership |
| Tenant boundary map (16 boundaries) | `docs/architecture/tenancy/tenant-boundary-map.md` | Trust-boundary roll-up |
| Privileged surface map | `docs/architecture/security/privileged-surface-map.md` | Edge Function and service-role facts |
| AI policy enforcement map | `docs/architecture/ai/ai-policy-enforcement-map.md` | AI path facts |
| Fitness functions | `docs/governance/FITNESS_FUNCTIONS.md` | CI and platform facts |
| Commercial readiness gap matrix | `commercial/READINESS_GAP_MATRIX.md` | Pricing, claims facts |
| Legal drafts and queues | `docs/legal/*.md` (17 files) | Counsel and claims facts |
| Scratchpad findings and inventory | `findings-{ai,commercial,database,platform,product}.md`, `inventory-platform.md` (audit scratchpad, not in the repo) | Counts and candidate risks; every count reused here was re-run |
| Existing architecture and program docs | `docs/ARCHITECTURE.md`; `docs/architecture/0001..0012-*.md`; `docs/architecture/data-architecture/README.md`; `docs/program/PHASE_0_1_RECONCILIATION.md`; `SEMESTER-OPERATING-SYSTEM.md` | Claims to be classified (section 6) |

## 2. Repository inventory

All commands run from the repository root on 2026-10-04. Tracked-file counts use `git ls-files`, so they exclude `node_modules/` and untracked scratch. Counts move as sibling Phase 0 work lands; the value shown is the value at the time of writing.

| Item | Count | Command |
| --- | --- | --- |
| Tracked files, whole repo | 5,569 | `git ls-files \| wc -l` |
| App screens (top-level `.tsx` in `app/src/screens/`) | 89 | `ls app/src/screens/*.tsx \| grep -vc test` |
| App routes: `Screen` union ids | 89 per the matrix; my own re-parse of `export type Screen` (`app/src/lib/types.ts:696`) returned 76 quoted ids, so the figure is **unreconciled** | `CAPABILITY_TRACEABILITY_MATRIX.md` section 2; `awk`/`grep -o` over `types.ts` |
| Lazy-loaded screens in the registry | 100 `lazy(` calls | `grep -c "lazy(" app/src/screens.tsx` |
| Files in `app/src/lib/` (all kinds) | 1,364 | `ls app/src/lib \| wc -l` |
| Non-test files in `app/src` | 1,576 (tracked, all types) | `git ls-files app/src \| grep -vc "\.test\."` |
| Migrations | 178 | `ls supabase/migrations/*.sql \| wc -l` |
| SQL check suites | 110 (all run by `supabase/check.sh`) | `ls supabase/*.check.sql \| wc -l`; `supabase/check.sh:52` |
| Edge functions | 16 (plus `_shared`) | `ls supabase/functions \| grep -v _shared \| wc -l`; `grep -c '^\[functions\.' supabase/config.toml` |
| Institution gateway Vercel function | 1 (`app/api/institution/[...path].ts`) | `find app/api -type f` |
| GitHub workflows | 12 | `ls .github/workflows \| wc -l` |
| Rulesets defined in repo | 1 (`.github/rulesets/main.json`); live ruleset count 0 per read-only `gh api` readback in `inventory-platform.md` (not re-run) | `ls .github/rulesets` |
| Workspace packages | 4 (`contract`, `institution`, `offline-sync`, `platform`) | `ls packages` |
| `app/package.json` scripts | 56 | `python3 -c "import json;print(len(json.load(open('app/package.json'))['scripts']))"` |
| Files in `app/scripts/` | 74 | `git ls-files app/scripts \| wc -l` |
| Files in root `scripts/` | 7 | `git ls-files scripts \| wc -l` |
| Shell scripts in `supabase/` | 5 at top level | `ls supabase/*.sh \| wc -l` (`inventory-platform.md` counts 8 at all depths) |
| Test files (all areas) | 1,415 | `git ls-files \| grep -cE '\.test\.(ts\|tsx\|mjs\|js)$'` |
| Markdown files under `docs/` | 1,372 | `git ls-files docs \| grep -c '\.md$'` |
| Root Markdown files | 70 | `ls *.md \| wc -l` |
| Decision records `docs/decisions/D-*.md` | 61 | `ls docs/decisions/D-*.md \| wc -l` |
| Accepted architecture records `docs/architecture/0001..0012` | 12 | `ls docs/architecture/[0-9]*.md \| wc -l` |
| Proposed ADRs in `docs/decisions/proposed/` | 25 (`ADR-0001..0025`, every Status field reads Proposed, none ratified; `grep -h "^| Status" docs/decisions/proposed/ADR-0*.md \| sort \| uniq -c`) | `ls docs/decisions/proposed \| wc -l` |
| Public-claims entries marked `available` | 0 | `grep -c "status: 'available'" app/src/lib/ops/claims.ts` |
| Capability rows marked `currentState: 'verified'` in code | 60 (a register value, not a production check) | `grep -c "currentState: 'verified'" app/src/lib/rollout-capabilities.ts` |
| `FORCE ROW LEVEL SECURITY` declarations in migrations | 0 | `grep -rhiE 'force row level security' supabase/migrations \| wc -l` |
| Non-test call sites of `decide(` outside its own module | 1 (`app/server/productivity/service.ts:380`) | `grep -rn "decide(" app/server packages/institution/src --include=*.ts \| grep -v test` |

## 3. What each top-level directory is

"Read" below means the audits opened the files named; for directories marked *header only* the audit read a README or manifest, not the code.

| Directory | Tracked files | What it is | Read by the audits? |
| --- | --- | --- | --- |
| `app/` | 3,215 | React/Vite/TypeScript SPA, `app/server/` (gateway, integration, productivity), `app/api/institution/` (Vercel function), `app/scripts/`, `app/public/` (214 MB working tree, largely audio) | Yes for architecture, state, AI, gateway; no for the bulk of the 89 screens (matrix classifies them by nearest tests, not by reading each) |
| `supabase/` | 407 | 178 migrations, 110 `*.check.sql`, 16 Edge Functions, `_shared`, `config.toml`, load and restore scripts, `DEPLOY.md` | Yes (tenant map, privileged surface map); migration bodies were sampled, not all read |
| `docs/` | 1,518 | 1,372 Markdown files: decisions, trust, finance, commercial, legal, program, architecture, evidence | Only the named inputs in section 1; most of the 1,372 pages were not read |
| `packages/` | 106 | `contract` (1 ts), `institution` (23), `offline-sync` (24), `platform` (50) per the matrix | Import graph checked (`CAPABILITY_TRACEABILITY_MATRIX.md` section 2.1); bodies sampled |
| `company-site/` | 35 | Static marketing site with its own `vercel.json` and CSP | Yes for claims and pricing (`commercial/READINESS_GAP_MATRIX.md`) |
| `infra/` | 42 | Terraform modules (`github_governance`, `supabase_project`, `vercel_gateway`), Rego policy, change records `CC-*` | README and risk register read; Terraform not applied |
| `ops/` | 9 | Operating registers (billing activation script, claims, customer commitments, master plan, console, strategic boundaries) | Header only |
| `database/` | 8 | Catalog-measured registers (`TENANT_ISOLATION_MATRIX.md`, `GRANT_ALLOWLIST.md`, `FUNCTION_AUTHORIZATION_MATRIX.md`, `DATA_CLASSIFICATION_REGISTER.md`) | Read via the tenant and surface maps |
| `commercial/` | 1 | `READINESS_GAP_MATRIX.md` (Phase 0 output) | Yes |
| `contracts/` | 1 | `README.md` only: per-tenant contract JSON (`contracts/<tenant id>.json`); no contract file is committed | Header only |
| `examples/` | 10 | Four reference programs (event consumer, gateway client, SCIM provisioner, SIS adapter), status `MOCK_DEMO` | Header only (`examples/README.md`) |
| `pipeline/` | 34 | Course-ingest and audio/video tooling (`ingest.py`, `new-course.mjs`, `validate.mjs`, `restyle-script.mjs` which calls the Anthropic SDK); own lockfile | Header only |
| `video/` | 28 | Remotion video renderer for lesson videos; own `package.json` and lockfile | Header only |
| `audio/` | 15 | Two-voice podcast scripts and `synth.py` | Header only |
| `extensions/` | 3 | One browser extension, `semester-capture` (manifest v3: `activeTab`, `scripting`, `storage`; `popup.html`, `popup.js`) | Manifest only; code **not** read |
| `project/` | 28 | Design-tool exports (`Semester.dc.html`, `Semester Phone.dc.html`, `Canvas.dc.html`, `_ds/`, `ios-frame.jsx`) | Listing only |
| `tasks/` | 2 | `plan.md`, `todo.md` (finalization execution checklist) | Header only |
| `chats/` | 1 | `chat1.md`, a design-tool conversation transcript | First lines only |
| `scripts/` | 7 | Company-site scan scripts and `scripts/infra/` | Names only |
| `.github/` | (12 workflows, `CODEOWNERS`, `dependabot.yml`, `rulesets/main.json`, PR template) | CI, deploy, scans, drift | Yes via `FITNESS_FUNCTIONS.md` |

## 4. Classification roll-up

Source: section 7 of `docs/program/CAPABILITY_TRACEABILITY_MATRIX.md`; recounted with `grep -E "^\| CAP-" docs/program/CAPABILITY_TRACEABILITY_MATRIX.md \| grep -c "\| <label> \|"` per label (105 rows, 60 repository IDs `CAP-001..060` plus 45 proposed IDs).

| Label | Rows | Share |
| --- | --- | --- |
| `OPERATIONAL-VERIFIED` | 0 | 0% |
| `OPERATIONAL-UNDER-GOVERNED` | 46 | 43.8% |
| `PARTIAL` | 45 | 42.9% |
| `CLIENT-ONLY-DEMO` | 10 | 9.5% |
| `DOCUMENTED-UNIMPLEMENTED` | 3 | 2.9% |
| `RETIRE-CANDIDATE` | 0 | 0% |
| `UNKNOWN-INVESTIGATE` | 1 | 1.0% |

`OPERATIONAL-VERIFIED` is empty because the label requires evidence that the thing runs and is deployed, and "no telemetry export, no run log committed" was found (`CAPABILITY_TRACEABILITY_MATRIX.md` section 5 "Classification rule I applied"). That is a statement about evidence found, not about quality. 46 rows are `OPERATIONAL-UNDER-GOVERNED` largely because they are device-first and hold no server policy by design (`docs/architecture/0001-local-first-with-supabase.md`).

Other roll-ups the audits produced:

| Surface | Distribution | Source |
| --- | --- | --- |
| 16 Edge Functions | 10 `OPERATIONAL-UNDER-GOVERNED`, 3 `PARTIAL`, 2 `UNKNOWN-INVESTIGATE` (`canvas`, `fetchcal`: SSRF controls not reviewed), 1 `OPERATIONAL-VERIFIED` for the self-delete path of `delete-account` only, with the map's own caveat that deployed state is not proven from the repo | `docs/architecture/security/privileged-surface-map.md` section 4 (recounted by `awk` over that table) |
| Commercial capabilities | Mixed `PARTIAL`, `DOCUMENTED-UNIMPLEMENTED`; billing for individuals is `OPERATIONAL-UNDER-GOVERNED`; institutional billing, RevOps, forecast, marketplace, hiring, board reporting are `DOCUMENTED-UNIMPLEMENTED` | `commercial/READINESS_GAP_MATRIX.md` section 2 |

## 5. Trust-boundary roll-up

Source: section 4 of `docs/architecture/tenancy/tenant-boundary-map.md` (16 boundaries; counted with `grep -E "^\| [0-9]+ \|"` and the label column).

| Label | Count | Boundaries |
| --- | --- | --- |
| `PARTIAL` | 9 | 1 institution gateway; 3 definer RPC; 4 RLS tables; 6 storage; 9 queue/outbox; 10 scheduled worker; 12 integration; 13 AI retrieval (gateway); 15 support tooling |
| `OPERATIONAL-UNDER-GOVERNED` | 4 | 2 Edge Functions; 5 views; 11 analytics; 16 break-glass |
| `CLIENT-ONLY-DEMO` | 1 | 7 search (one client-side ranker) |
| `DOCUMENTED-UNIMPLEMENTED` | 1 | 14 vector retrieval (none exists) |
| `UNKNOWN-INVESTIGATE` | 1 | 8 cache (service-worker clearing on sign-out not established) |
| `OPERATIONAL-VERIFIED` | 0 | none |

The tenant term is `school` (`profiles.school_id`, older tables), `tenant_id text references public.schools(id)` (newer tables) and `institutionId` in the gateway; they are one key (`tenant-boundary-map.md` section 1; `supabase/migrations/20260921170000_schools.sql`). Two live tenant derivations exist (browser RLS through `profiles.school_id` and `role_grants`; the gateway through `institution_membership`), and a third (`app.tenant_id()` per transaction with forced RLS) is design only: `grep -rn 'app.tenant_id' supabase/migrations` returns nothing, and `FORCE ROW LEVEL SECURITY` appears 0 times.

## 6. Headline findings

Severity distribution in `docs/program/RISK_REGISTER.md`: P0 2, P1 23, P2 10, P3 1 (36 rows, `grep -cE "^\| R-[0-9]+ \| P<n> "`). The ten that shape everything else:

| # | Finding | Risk ID | Evidence |
| --- | --- | --- | --- |
| 1 | No per-class cross-tenant negative test suite exists, so "school A cannot read school B" is asserted by per-table policy and 110 check suites but not shown for the 155 tenant-scoped tables | R-001 (P0) | `database/TENANT_ISOLATION_MATRIX.md`; `docs/architecture/tenancy/tenant-boundary-map.md` section 4 row 4 |
| 2 | No restore or point-in-time-recovery exercise against the live project; recovery time and point unknown | R-002 (P0) | `RESTORE.md`; `docs/evidence/restore/2026-09-30-logical-rehearsal.md` (local throwaway database, one account) |
| 3 | 50 tables are written straight from the browser (floor, by regex); the per-table RLS and audit matrix was never written | R-003 | `docs/program/CAPABILITY_TRACEABILITY_MATRIX.md` sections 2 and 4 |
| 4 | The gateway runs as service role and filters by `tenant_id` in application code; nothing structural checks the filter | R-004 | `app/server/institution/intelligence-repository.ts`; `docs/architecture/tenancy/tenant-boundary-map.md` row 1 |
| 5 | Tenant AI policy binds only the institution gateway; `ask()` in `app/src/lib/claude.ts` (25 importing files) and `converse.ts` ignore it | R-010, R-011 | `docs/architecture/ai/ai-policy-enforcement-map.md` section 1 |
| 6 | `main` has no live ruleset or protection and CI is red about half the time (48 of the latest 100 push runs) | R-014, R-015 | read-only `gh api` readback recorded in `inventory-platform.md` and `docs/governance/FITNESS_FUNCTIONS.md` rows 13, 14; not re-run for this document |
| 7 | The policy decision point and outbox are specified (`docs/architecture/0007`, `0008`) but barely adopted: one non-test `decide(` call, one outbox producer | R-019, R-009 | `app/server/productivity/service.ts:380`; `supabase/migrations/20261004123000_productivity_commands.sql:351` |
| 8 | One person holds every company seat; backups and customer-side seats are unassigned | R-018 | `OWNER-AND-ACCOUNTABILITY-MATRIX.md`; `docs/program/DOMAIN_OWNERSHIP_MATRIX.md` section 1 |
| 9 | Institutional prices are unsourced and the nine program pricing targets do not appear in the repo; public claims exceed evidence (0 of 40 `claims.ts` entries are `available`) | R-023, R-024 | `commercial/READINESS_GAP_MATRIX.md` sections 1 and 3 |
| 10 | Counsel is not engaged and 77 `[DECIDE]` placeholders remain in policy drafts, none in force | R-025 | `LEGAL-REVIEW-QUEUE.md` Q-00; `grep -c '\[DECIDE' docs/legal/*.md` |

Nothing in this table is a claim that the system is, or is not, secure or compliant; it is what the repository's evidence does and does not show.

## 7. What the repository's own documents prove versus only assert

| Document | What it proves | What it only asserts |
| --- | --- | --- |
| `docs/architecture/0002-rls-is-the-authorization-boundary.md` | RLS is declared on every table in the migrations and the suites in `supabase/*.check.sql` walk second accounts (static tests `app/src/lib/tablerls.test.ts`) | "The strongest part of the codebase"; its "15 suites, 334 checks" is a historical figure (the tree has 110 suites) |
| `docs/architecture/0007-policy-decision-point.md`, `0008-event-envelope-and-outbox.md` | The evaluator and tables exist and have unit/SQL tests | That the platform uses them: adoption is one call and one producer |
| `docs/architecture/0003-no-application-server.md` | The Edge Functions exist | "Six functions" (16 exist); a gateway on Vercel was added since and the doc's own gap section says hosting is undecided (`docs/ARCHITECTURE.md` full-beta target, C-4) |
| `docs/ARCHITECTURE.md` invariant 9 ("never by a build flag") | A written rule | Contradicted by 73 `VITE_*` flags in `.github/workflows/pages.yml` (R-020) |
| `app/src/lib/rollout-capabilities.ts` | 60 stable IDs | `currentState: 'verified'` on all 60; contradicted by `docs/product/capability-inventory.md` (R-029) |
| `FEATURE-INVENTORY.md`, `database/README.md`, `docs/architecture/multi-tenant-isolation.md` | Their state at the dated commit | Current counts: 260 test files, 106 suites, 171 migrations versus 1,415, 110, 178 now |
| `docs/DEFINER-RLS-REGISTER.md` | The register equals the winning definitions in migrations intersected with the grant allowlist (`app/src/lib/definerregister.test.ts`) | That each gate is correct; 25 production functions unreconciled |
| `docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json` | A drill ran against the shared-key function on that date | That the gate added on 2026-10-01 holds; the activation record is all `pending-owner` |
| `RESTORE.md` | A procedure and an empty result table | Any restore time |
| `docs/BRANCH-PROTECTION.md` | The ruleset definition `.github/rulesets/main.json` | That it is applied: "Applied" table empty and `protected:false` at readback |
| `docs/legal/*-DRAFT.md` (13 policy drafts) | Drafting exists | Any policy in force; every legal row is gated by Q-00 (counsel) |
| `docs/program/CAPABILITY_TRACEABILITY_MATRIX.md` | Which code, tables and tests exist per capability | Production use; "no run results were read" |
| `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md` | A live monthly individual charge was exercised | Annual, refund, failed renewal, dispute (not exercised) |
| `SEMESTER-OPERATING-SYSTEM.md` | Which document is authoritative for 61 entries and the review cadence | That "7 of 12 seats held" means independent holders: `OWNER-AND-ACCOUNTABILITY-MATRIX.md` names one person for every company seat |

## 8. Coverage statement: what this baseline did not read

Be explicit: this is a synthesis of other audits, spot-verified, and those audits sampled.

- **Not read at all (beyond a README, manifest or listing):** `extensions/semester-capture/popup.js` and `popup.html`; `video/` (Remotion code); `pipeline/` (all scripts except the header of `restyle-script.mjs` noted in the AI map); `audio/` scripts; `project/` design exports; `chats/chat1.md` (first lines only); `tasks/`; `examples/*` code; `ops/*` registers beyond names; `contracts/` (only a README exists).
- **Sampled, not exhaustive:** the 178 migration bodies (the tenant and surface maps read named files); the 89 screens (classified through nearest tests and the registry, not each read); `packages/platform` (50 files, import graph checked, bodies sampled); the 1,372 Markdown files under `docs/` (only the inputs in section 1 and a handful of cited neighbours).
- **Not executed:** no test suite, `npm run` gate, `supabase/check.sh`, or `*.check.sql` ran. Every "test exists" statement means the file exists and was read or counted, not that it passes. `REGRESSION-CHECKLIST.md` baseline figures are therefore not re-established.
- **No production access:** counts attributed to the production catalog (354 objects, 319 public tables, 269 definers) are the repository's own dated readings in `database/*.md`, not re-measured here. The Actions secrets API returned 403 in the platform audit, so secret and variable names were not read.
- **Accessibility, performance, load, visual rendering:** no browser was driven, no screenshot taken (`.claude/skills/run` was not used). Nothing here says anything about how the app looks or whether it meets WCAG.
- **Legal and compliance:** nothing here is a legal conclusion; FERPA, COPPA, GDPR, accessibility conformance and security-readiness questions are for counsel or qualified assessors.
- **Later main:** `origin/main` has moved from `4adb8cc` to `c170dcd`; merges after `4adb8cc` were not folded in.

## 9. No readiness claims

This document does not say the product is ready, secure, compliant, accessible, scalable or sellable. The evidence it cites shows structure (what code, tables, tests and documents exist) and gaps (what is missing or not exercised). Any "ready" statement requires evidence of production operation that this repository does not hold today (section 4: 0 `OPERATIONAL-VERIFIED` capabilities; section 5: 0 `OPERATIONAL-VERIFIED` boundaries).

## Open questions / not verified

1. Whether the institution gateway and `VITE_UNIVERSITY_GATEWAY_URL` are set in production (R-031; `.github/workflows/pages.yml:124` reads the variable, the value is not in the repo).
2. Reconciliation of the `Screen` union count (89 in the matrix versus 76 from my regex) and of the `VITE_*` flag count (73 in the matrix; `sed -n 118,210p .github/workflows/pages.yml | grep -c VITE_` returns 74 lines).
3. Whether GitHub-native secret scanning, push protection and Dependabot security updates are enabled (settings unreadable with the audit token).
4. Whether any production tenant exists, has `enforce_membership` on, or uses the gateway.
5. Table owner and `rolbypassrls` for production roles (no catalog query cited by `database/TENANT_ISOLATION_MATRIX.md`).
6. Why `main` CI failed on 2026-10-04 (R-015 cause undiagnosed).
7. The content and risk of the unread directories in section 8, especially `extensions/` (a browser extension holding `activeTab` and `scripting`), which has no audit coverage.
8. Where the nine program pricing targets originate (outside the repo?), per `commercial/READINESS_GAP_MATRIX.md` open questions.
