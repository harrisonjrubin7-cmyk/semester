# Stream 03 · Student OS

Every student screen in catalog group B and the student side of F and G.

Paste this file into Claude Code (or Codex) at the repo root.

## Inputs from the design project
- `ui_kits/student/` (64 screens)
- `ui_kits/mobile/`
- `templates/platform-shell/`
- `templates/student-screen/`
- `ui_kits/workflow-runner/` (Student, Student finance, Campus services)

## Tasks
1. For each screen in docs/master/SEMESTER_SCREEN_CATALOG.md group B: route, data from read models, source labels, all states.
2. Today, Action Center, Path, Plan, Registration readiness, Courses, Notes, Files, Search, Ask Semester, Support, Campus, Career, Account, Privacy and data, Data export/delete.
3. Run every Student workflow step from the runner end to end against staging data.
4. Mobile: five-destination tab bar, offline queue, PWA install.

## Coverage check
List every screen in docs/master/SEMESTER_SCREEN_CATALOG.md and every step in SEMESTER_WORKFLOW_CATALOG.md that belongs to this stream (see BUILD.md §10). Mark each implemented (route + test) or deferred (reason + priority). Use ui_kits/every-screen and ui_kits/workflow-runner as the visual and behavioural reference.

## Exit gates
- [ ] Coverage check complete with no unlisted screens or steps
- [ ] Each Student workflow step passes an e2e test
- [ ] Every screen has all 5 states
- [ ] Lighthouse a11y 95+ on the top 10 screens

## Rules (every stream)
- Repo: harrisonjrubin7-cmyk/semester. Work on branch `semester/student-os` from latest `origin/main`. Open one PR per stream; merge only after CI is green and a human approves.
- Read first: CLAUDE.md, README, `git log --oneline -30`, and this design project's `readme.md`, `SKILL.md`, `docs/master/*`.
- Audit before you write: find what already exists for each item and extend it. Do not create a parallel implementation. Record each "exists / extended / new" decision in the PR description.
- Design system: use tokens and components only (no raw hex, px z-index or durations); `npm run design-system:check` must pass.
- Data: RLS on every table, `tenant_id` on every row, browser calls `api.*` only. Company roles (investor, CS, RevOps, finance) never read student tables. AI never receives student records.
- Every consequential action: preview, then audit event written first, then apply, then an undo or request path.
- Every screen: loading, empty, error, forbidden and offline states, keyboard path, visible focus, accessible names, 44px targets.
- Do not commit secrets, change production settings, deploy, or write to Figma. Stop and report on the first failure you cannot fix inside this stream.
- Nothing is "done" without code, tests, RLS proof, accessibility check, monitoring hook, docs and release evidence (the 22-point definition in `docs/master/SEMESTER_RELEASE_GATE_CATALOG.md`).

## Report at the end
Files changed · commands run with results · tests added · RLS cases proven · open gaps with priority · what the next stream needs.


## Master plan (added Oct 7 2026)
Prototype `#/student/masterplan` (`MasterPlan.jsx`). Source: `docs/system/Semester Master Plan and Workflow SOP.pdf`.
- One projection over course → milestone → assignment → released result → private study block. No copies of assignments.
- Released-point subtotals only; ungraded excluded, never zero. Not a final grade.
- `CreatePrivateStudyBlock` command: validate (source fresh, ends before due, no overlap) → preview → confirm → commit block + audit + outbox in one transaction → `personal.study_block.created.v1`.
- Consumers (master view, calendar, Action Center, reminders) dedupe by event id; a consumer failure retries and never rolls back the saved block.
- Calendar shows the same blocks (projection). Planned ≠ submitted; self-marked done ≠ receipt.

### Priority + personal grade calculator (Oct 7 2026)
Source: `docs/system/Semester Master Plan SOP - Calculator Update.pdf`.
- Prototype priority rule (visible, simple): submitted/graded → Low; stale source or due ≤72h → High; ≤7d → Medium; else Low. Production replaces it with the documented next-action ranking (urgency, consequence, confidence, effort, overload) using institutional timezone.
- Points subtotal = Σ known earned / Σ corresponding possible × 100; coverage = known possible / all listed possible. Blank = unknown, 0 = zero. All blank → no estimate (error, not 0%).
- Weighted estimate = Σ(category % × weight) / Σ scored weight; weights must total 100%; always show coverage; partial ≠ final grade.
- No drop/attempt/late/rounding/letter/extra-credit rules; above-max allowed with warning. Course change clears inputs. Hypotheticals private; never write released records.
- Tests in prototype (MasterPlan.jsx `mpxCalcRun`): blank unknown, zero counts, weights ≠100 rejected, coverage shown, negative rejected, above-max warns — all pass.
- Boundaries: personal (notes, estimates, blocks, what-if) · institution (course, submission, released results) · company (sanitized health only). Enforce at DB, storage, search, cache, exports, events, AI retrieval.

### Scheduling validation (fixed, Oct 7 2026)
Reference: `docs/system/semester-validation-and-grade-calculator.js.txt` (rename to .js to run), tests in `docs/system/*.json`. Prototype port: `mpxParse`, `mpxValidate`, `mpxPri` in `MasterPlan.jsx` — 24 logic checks run live from the screen (“Run 24 checks”): scheduling, priority boundaries and calculator incl. the worked example 87.0% / 60% coverage (past, overlap, end-at-deadline, after-deadline, Feb 30, blank / 50-min duration, invalid existing block, stale, priority boundaries at 72h / 72h+1m / 7d / 7d+1m, overdue, submitted+stale, invalid deadline).
- Strict `YYYY-MM-DDTHH:MM` parse; reject rollover (Feb 30). Invalid or stale deadline → priority “Needs review”, checked before submitted.
- Duration 15–480 min in 15-min steps. Reject starts before now. Reject when any existing block is invalid.
- Validate at preview AND again at save with fresh time. Server must re-validate and guard concurrent changes (aggregate version).
- Valid format ≠ matches syllabus; deadline checker never edits the official deadline.

### Local datetime helpers (Oct 7 2026)
Reference: `docs/system/semester-local-datetime-helpers.js.txt` + `semester-parser-edge-case-tests.json`. Accept only `YYYY-MM-DDTHH:mm` (no seconds, offsets, Z, date-only, padding). Reject rollover (Feb 29 non-leap, Apr 31, month 13, 24:00, :60) and spring-forward gaps; fall-back repeat hour is ambiguous (accepted, first occurrence). Populate inputs with a local formatter, never `toISOString().slice(0,16)`. Production stores institution timezone explicitly. Prototype runs 41 checks (14 parser + formatter + 2 DST in America/Chicago).

### Workload heatmap, grade targets, daily-plan generator (Oct 7 2026)
Source: `uploads/x-heatmap.pdf`. Prototype: `MasterPlan.jsx` (`mpxWorkload`, `mpxPlanGen`, `mpxTarget`); 48 checks pass.
- Heatmap: 7 days; confirmed blocks only, clipped at midnight; levels Empty / Light (≤50% capacity) / Balanced (≤100%) / Over capacity, always as words; due count and estimated effort shown separately from planned time.
- Generator: exclude submitted/graded; report invalid, stale or passed deadlines; subtract planned minutes; score = urgency × w + assessment weight × (1−w); greedy 30-min slots + final 15 within the daily window; skip past, overlaps, after-deadline; report unscheduled minutes; preview the batch; revalidate every block at save; no partial save.
- Grade target: required = (target × 100 − finalized avg × finalized weight) ÷ remaining weight; label unreachable (>100%) and secured (≤0). Assumes scored categories are final; targets never change study time or ranking.
- Storage: only sem-mpx-* keys on the device; “Forget my saved plan” removes them.

### ICS export + balanced planner v2 (Oct 7 2026)
Source: `docs/system/Daily Plan ICS Export and Balanced Planner.pdf`. Prototype: `mpxPlanGen` (v2), `mpxIcs`; 56 checks pass.
- Planner: least-loaded feasible day; ties by course load then earliest start; 30-min sessions, final 15; breaks (default 10) consume availability; per-course daily cap (default 90); never before now; report unscheduled minutes.
- Export: confirmed blocks only; scope (7 days / all), course filter, reminder (none/10/30 → VALARM). ICS: UTC DTSTART/DTEND, stable `UID:<blockId>@semester.study`, CRLF, RFC 5545 escaping, UTF-8-aware 75-octet folding, CLASS:PRIVATE (label, not encryption). Private-plan JSON with timezone.
- Import ≠ sync. Live sync needs authorized connector, user approval per write, block↔provider event-ID map, idempotent create/update/delete, conflict handling, revocation. Never export grades, targets or tokens.
