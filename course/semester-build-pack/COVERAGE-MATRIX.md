# Semester build pack: inventory, coverage matrix and continuation record

Source: `caa40c84-Semester_Developer_and_Curriculum_Build_Pack.zip` and four standalone uploads. The standalone portal, OpenAPI file and syllabus PDF are byte-identical to the copies in the zip (md5 checked).

Status vocabulary: **proposed** (document only, needs approval) · **specified** (defined, not built) · **in progress** · **blocked** · **implemented** · **verified** (evidence below) · **deployed**.

The pack's own README states it is a "generated design and local prototype; no production deployment". Nothing in this directory is deployed.

## 1. Inventory and coverage matrix

Columns are reduced from the full template where they do not apply to a docs-and-prototype pack. Workspace, role and permission columns are marked "n/a" because the pack defines no tenants, workspaces or accounts; those are specified only in the architecture guide (section 3 below).

| ID | System or item | Module or screen | Role | Required behavior | Acceptance evidence | Status | Verification evidence | Blockers |
|---|---|---|---|---|---|---|---|---|
| SYS-PORTAL | Learning portal `portal.html` | 16 module list, lesson view, search, starter downloads, progress, export/import, architecture, syllabus, certification, API inspector | Learner | Browse modules; search; download starters; track progress locally | Loads with no JS errors; search filters; no horizontal scroll at 320px | implemented, partially verified | See section 3, checks P1–P4 | Lesson download, progress export/import round trip, API and certification tabs not exercised. No authentication; progress is browser-local (per README) |
| SYS-GRADER | `grader.py` | `--lab 1..16` runner | Learner, instructor | Run visible tests, write JSON report | Starters score 0 with exit 1; a correct solution scores full with exit 0 | implemented, verified for trusted local use only | Checks G1–G2 | Not a sandbox (grader's own warning; ARCH §8). Production runner not built |
| SYS-OAS | Developer console contract `developer-console.openapi.json` | 68 operations, 53 paths, 54 schemas | Partner developer (proposed) | Control-plane API for organizations, apps, installations, grants, webhooks, releases, certification, pilots, offboarding, audit, support | Passes OpenAPI structural validation; unique operation IDs | specified (contract only), structurally verified | Check O1 | No service implements any operation. Semantic conformance tests not written. Base URL and OAuth endpoints are placeholders |
| SYS-SYLLABUS | Syllabus and lab PDF | Course document | Instructor, learner | Outcomes, weekly rhythm, assessment, rubrics, integrity policy | File identical to upload | proposed | md5 match | Requires instructor and institutional approval (syllabus text) |
| SYS-ARCH | Architecture guides | 11 sections | Engineers | Trust boundaries, identity, authorization, API rules, events, SDK, grading isolation, AI policy, release | Document present | specified | n/a | Nothing in section 1 of the guide is implemented (see section 2) |
| SYS-CERT | Partner certification workflow | 16 steps with owner, evidence and exit gate | Partner operations, security, institution approver | Register publisher through institutional pilot activation | Document present | proposed | n/a | No owners, review panel, records or evidence store exist. No SLA or legal timeline adopted |
| SYS-CAP | Capstone: synthetic planning extension | Tenant-scoped tasks, shared-shell UI, typed client, duplicate-safe events, revocation | Learner | Build across weeks 4–16 increments | Rubric in syllabus | specified | n/a | TypeScript toolchain is an instructor choice; no capstone starter exists |
| LAB-01 | System boundaries | Week 1 | Learner | Classify draft, grade and fixture records | Visible tests: 3 | specified; starter verified failing; pass path verified via control | Checks G1, G3 | Reference solution not in pack |
| LAB-02 | Git and engineering evidence | Week 2 | Learner | Lab 2 | Visible tests: 2 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-03 | Contracts and validation | Week 3 | Learner | Lab 3 | Visible tests: 3 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-04 | Pagination and API design | Week 4 | Learner | Lab 4 | Visible tests: 3 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-05 | Authentication versus authorization | Week 5 | Learner | Lab 5 | Visible tests: 3 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-06 | Tenant isolation | Week 6 | Learner | Lab 6 | Visible tests: 3 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-07 | Transactions and audit | Week 7 | Learner | Lab 7 | Visible tests: 2 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-08 | Accessible interfaces | Week 8 | Learner | Lab 8 | Visible tests: 2 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-09 | Idempotency | Week 9 | Learner | Lab 9 | Visible tests: 3 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-10 | Events and deduplication | Week 10 | Learner | Lab 10 | Visible tests: 2 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-11 | Diagnostics and recovery | Week 11 | Learner | Lab 11 | Visible tests: 2 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-12 | Typed SDK behavior | Week 12 | Learner | Lab 12 | Visible tests: 3 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-13 | Security threat modeling | Week 13 | Learner | Lab 13 | Visible tests: 4 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-14 | Release and certification evidence | Week 14 | Learner | Lab 14 | Visible tests: 2 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-15 | Pilot reconciliation | Week 15 | Learner | Lab 15 | Visible tests: 2 | specified; starter verified failing | Check G1 | Reference solution not in pack |
| LAB-16 | Capstone activation and defense | Week 16 | Learner | Lab 16 | Visible tests: 2 | specified; starter verified failing | Check G1 | Reference solution not in pack |

Total visible cases: 40 (matches the README). The README's claim that 40 cases passed against reference implementations cannot be re-run here because references are not in the pack.

### 1a. Developer console operations by tag (OAS)

| Tag | Operations | Tag | Operations |
|---|---|---|---|
| Webhooks | 8 | Pilots | 2 |
| Grants | 6 | Offboarding | 2 |
| Certification | 6 | Permissions | 1 |
| Apps | 5 | Events | 1 |
| Installations | 5 | Exports | 1 |
| Memberships | 5 | Jobs | 1 |
| Environments | 4 | Audit | 1 |
| Credentials | 4 | Usage | 1 |
| Releases | 4 | Capabilities | 1 |
| Organizations | 3 | Evidence | 2 |
| Support | 3 | Tests | 2 |

Total 68. Every operation is **specified, not implemented**.

### 1b. Shared platform capabilities (from the architecture guide)

| ID | Capability | Guide section | Status |
|---|---|---|---|
| PLAT-IDENTITY | Browser session/BFF, PKCE for native and confidential clients, client credentials for machine integrations, token validation | §3 | specified |
| PLAT-AUTHZ | Identity, app, environment, installation, grant, tenant, purpose and property checks; revocation propagation | §2, §4 | specified |
| PLAT-IDEMP | Idempotency keys bound to principal/app/tenant/environment/operation/digest; ETag and If-Match; opaque cursors | §5 | specified |
| PLAT-EVENTS | Transactional outbox; signed webhook envelope; egress validation and SSRF defenses | §6 | specified |
| PLAT-SDK | `@semester/contracts`, `@semester/sdk`, `@semester/sdk-server`, `@semester/testing` | §7 | specified |
| PLAT-GRADING | Disposable isolated grading workers (no credentials, no network, bounded resources) | §8 | specified; `grader.py` is trusted-local only |
| PLAT-AI | No student records to AI; AI cannot grant permissions or certify | §9 | specified (policy) |
| PLAT-RELEASE | CI gates for types, contracts, RLS, negative authorization, E2E, accessibility; preview and staging separate from production | §10 | specified |

### 1c. Operational and administrative requirements

| ID | Requirement | Status | Blocker |
|---|---|---|---|
| OPS-DEPLOY | Choose and provision a staging target | blocked | No target, host, domain, or credentials exist in the pack or session |
| OPS-MONITOR | Monitoring, error visibility, backups, runbooks | not started | Depends on OPS-DEPLOY |
| OPS-ROLLBACK | Rollback procedure for the portal and API | not started | Depends on OPS-DEPLOY |
| OPS-SUPPORT | Support and incident contacts | not started | Named owners not provided (cert step 2) |

### 1d. Devices and platforms

| Surface | Required support | Basis |
|---|---|---|
| Portal | Any modern desktop or mobile browser; usable at 320px | Pack README; verified in headless Chromium at 320px (desktop 1280px screenshot also captured) |
| Labs and grader | Python 3 on a local host | Pack README and syllabus |
| Native mobile or desktop apps | Not in the pack. Not built. Not required unless confirmed | None |

## 2. What is built and what is not

Built or verified in this directory:
- Portal, grader, 16 starters with visible tests, OpenAPI contract, syllabus PDF, architecture guide, certification procedure, and the README.
- Local verification as described in section 3.

Not built (all specified only):
- The developer console service behind the 68 operations, the OAuth/OIDC identity layer, tenant isolation and RLS, idempotency and event outbox, SDK packages, isolated grading runner, capstone starter, certification records, and operations (monitoring, backups, runbooks).
- Reference solutions for labs 2–16 (not in the pack).

## 3. Verification evidence (this session)

| ID | Check | Command or method | Result |
|---|---|---|---|
| G1 | 16 starters fail as designed | `python3 -I grader.py --lab N --submission labs/week_0N/starter.py --report <out>` for N = 1..16 | 0 of N passed for every lab; exit code 1; no execution error; each report written |
| G2 | Grader pass path works (control) | Scratch solution `classify_record` for lab 1 (dict lookup on `kind`) run through the grader | 3 of 3 passed; exit code 0 |
| G4 | Learner `print()` does not corrupt results | Lab-1 control plus a `print()` call through the old runner, then the fixed runner | Old runner: 0 of 3, "Timeout or invalid output" (reproduced). Fixed runner: 3 of 3, exit 0. Fixed runner still exits 1 on all 16 starters with 0 passes |
| G3 | Lab 1 control covers the visible cases | `tests.json` lab 1 expects draft→private, grade→official, fixture→synthetic | Matches the control's mapping |
| O1 | OpenAPI validity | `openapi-spec-validator` (latest from PyPI, installed in a scratch venv) on `developer-console.openapi.json` | Valid. 68 operations, 0 missing or duplicate operationIds, 53 paths, 54 schemas |
| P1 | Portal loads without JS errors | Headless Chromium (`/opt/pw-browsers/chromium`) with `--enable-logging=stderr`; control page with `console.error` and an uncaught throw was logged, so the logger works | 0 console or uncaught errors |
| P2 | Week search filters the module list | Iframe probe: set search input to `Idempot` and dispatch `input` | 16 → 1 (`Week 9: Idempotency`) → 0 for a non-matching query |
| P3 | No horizontal scroll at 320px (before fix) | Iframe probe, 320px wide | scrollWidth 386 vs clientWidth 305; 2 overflowing elements: the "Import personal progress" file input and its label (370px, min-width auto as a flex item) |
| P4 | No horizontal scroll at 320px (after fix) | Same probe | scrollWidth 305 = clientWidth 305; 0 overflowing elements |
| P5 | Desktop render | Headless Chromium screenshot at 1280×900 | Captured to scratch; image not opened by the agent (image viewing was blocked by a local hook) |

Not run: Playwright end-to-end tests (install hung on the proxy), keyboard and screen-reader audit, the progress export/import round trip, the API tab's search, lesson downloads, OpenAPI semantic conformance tests, any test of the repo's own gates (no file under `app/` changed).

## 4. Changes in this change set

- Added `course/semester-build-pack/` (58 files copied from the pack).
- `portal.html`: one CSS line added to the style block, `.toolbar>label{min-width:0;max-width:100%}input[type=file]{width:100%;max-width:100%}`, which fixes the 320px horizontal overflow (P3→P4). No other changes. The file therefore differs from the uploaded copy (md5 differs).
- Added this file.

## 5. Decisions needed before deployment or further build

1. **Deployment target.** Which host and environment should receive the portal (static file hosting, the existing app's staging, or none)? Publishing the portal outside this repository is an external communication and needs your approval.
2. **Where the developer console lives.** `app/` already contains a Semester product, and the architecture guide says to inventory the repository before adding duplicate infrastructure. `course-engine/` is a separate product. Choose one home for the API (inside `app/`, a new service, or outside the repo).
3. **Identity provider and database** for the API. The guide requires RLS, OAuth/PKCE and signed webhooks; the existing stack's choice of these is not confirmed in this pack.
4. **Reference solutions for labs 2–16.** Confirm whether the course team will supply them. Without them the 40-case claim is unverified.
5. **Institutional approval.** The syllabus and certification workflow are marked "proposed". No owner or approver is named in the pack.
6. **Isolated runner.** Required before any learner code is run outside a trusted local setting.

## 6. Continuation record

Completed: import, portal fix, grader and OpenAPI verification, portal checks, this matrix.

Next executable tasks, once decisions 1–3 are answered:
1. Stand up the chosen staging target; deploy `portal.html`; re-run P1–P4 against the deployed URL.
2. Implement the first API vertical slice (organizations, apps, environments) with idempotency keys and ETag, and write contract tests against `developer-console.openapi.json`.
3. Add an OpenAPI semantic conformance suite (error envelope, cursor binding, If-Match) before any operation is marked implemented.
4. Choose and implement an isolated grading runner (ARCH §8) before learner submissions are accepted.
