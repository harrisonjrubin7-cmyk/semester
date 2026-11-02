# Semester: start here

This zip is the complete Semester design project: design system, interactive prototype, specifications and build plan. A coding agent can build every part of Semester from it.

## 1. Put it in the repo (2 minutes, you do this)

```bash
git clone https://github.com/harrisonjrubin7-cmyk/semester.git && cd semester
git switch -c semester/handoff-intake
mkdir -p design docs/specifications/source
unzip ~/Downloads/<this-zip>.zip -d design/
cp design/uploads/*.pdf docs/specifications/source/
cp design/handoff/specifications/*.pdf docs/specifications/
git add design docs/specifications && git commit -m "Add Semester design handoff"
```

Never add credentials, production exports, student records or real financial data to `design/` or `docs/`.

## 2. Paste this into Claude Code (or Codex / Cursor agent) at the repo root

```text
You are building Semester, a role-based education operating system, in this repository.

READ FIRST, IN ORDER
1. design/handoff/BUILD.md  ("Read this first": the live repo wins every conflict)
2. design/handoff/execute/00-INDEX.md  (stream order, branches, exit gates)
3. design/handoff/prototype/README.md and SCREEN-INVENTORY.md  (every screen, its prototype component and its stream)
4. design/readme.md and design/SKILL.md  (design rules, tokens, components)
5. docs/specifications/ and docs/specifications/source/  (requirements PDFs; SPEC-INDEX.md maps them)

PATHS: handoff docs were written relative to the design project root. In this repo that root is design/, so "handoff/x" means design/handoff/x and "ui_kits/x" means design/ui_kits/x.

THE PROTOTYPE IS THE ACCEPTANCE REFERENCE
design/ui_kits/semester-app/All Screens.html shows every route live, in each of six states (default, loading, empty, error, no permission, offline). Every production screen must implement all six.
design/ui_kits/semester-app/index.html (desktop) and mobile.html (phone) show every workspace and screen with working interactions and demo data. Open a screen at index.html#/<workspace>/<screen>. Reproduce its behavior, states and copy in the real stack. Do not ship the prototype's HTML/JSX; rebuild it in the repo's framework and component system.

HOW TO WORK
- Run design/handoff/preflight.sh, then design/handoff/install.sh.
- Run the streams in design/handoff/execute/ in the order listed in 00-INDEX.md (00 → 24). One branch per stream: semester/<slug> from origin/main.
- In each stream: build every screen listed, implement every "Behaviors to reproduce" bullet against real data and services, add server-side authorization (deny by default) with negative tests, cover empty/loading/error/offline/denied states, and run design/handoff/verify.sh.
- Write docs/execute/<nn>-<slug>-report.md with evidence, open a PR, and STOP for human review before the next stream.
- Keep docs/mainframe/SESSION_HANDOFF.md current so a new session can resume.

NEVER, WITHOUT EXPLICIT HUMAN APPROVAL
Deploy to production, apply remote migrations, change secrets or tenant/identity config, send real messages, move money, change academic records, or mark anything complete without test evidence. Use synthetic data only.

START NOW with stream 00.
```

## 3. Continue in later sessions

```text
Continue building Semester. Read docs/mainframe/SESSION_HANDOFF.md, design/handoff/execute/00-INDEX.md and the last stream report. Pick the next stream whose dependencies are merged, and run it to its exit gates. Stop for review at the PR.
```

## Company documents
Start from `docs/Master Library.html` (11 sections, templates, status vocabulary) and `docs/MASTER_CURRENT_STATE.md`. New documents start from `docs/templates/` with front matter (artifact_type, owner, status, source_of_truth, authority, classification, reviews, release_gate).
`docs/Master Artifact Register.html` is the authoritative register: 857 artifacts (documents, models, diagrams, presentations, guides, controls, infrastructure, evidence) with owner, priority, activation gate and five statuses (documentation, capability, authorization, evidence, executed). Edit statuses there and export CSV into the repo as `docs/register/artifacts.csv`. The agent must never treat a drafted document as permission to activate a capability.
`docs/Document Library.html` indexes all 64 business, legal, compliance, finance and GTM documents (24 added 6 Oct: FERPA statement, NDPA crosswalk, HECVAT pack, VPAT/ACR, InfoSec policy, SOC 2 plan, Trust Packet, FERPA/COPPA register, K-12 gatekeeper, AI charter, bylaws outline, integration playbook, RBAC matrix, audit ledger, hiring gates, price sheet, pilot evidence + intake, PLG scoring, sales narrative, grant brief, ambassador playbook, commercial readiness, dual-engine model). Copy `docs/` into the repo with the rest of the design project; legal drafts need attorney review before use.

## What only you can do
Track and record these in the prototype at `#/company/approvals` (Your approvals); the agent's PRs and stream reports are the evidence.
Listed in `execute/00-INDEX.md` under "Founder-only steps": sign the DPA/FERPA addendum, insurance, HECVAT, attorney review, approving every PR, naming institution contacts, and any production or financial action.


## Credit planner static package
See `docs/reference/university-planner-app/INTEGRATION.md` for the proposed `app/public/credit-planner/` mount (feature branch + PR only; two test files still need uploading).


## Latest (Oct 7 2026)
New build streams since the first handoff, in `handoff/execute/`:
- `25-completion-program.md`: 18 packages, six independent status stages, screen contract, platform blockers. Gates every other stream's "done".
- `26-faculty-os-intelligence.md`: Faculty home + Semester Intelligence (executive assistant, research partner, AI TA), feature matrix, research privacy, sandboxed grading.
- `29-account-identity-mail.md`: Semester Account & Identity + Semester Mail.
- `28-career-interview.md`: Career OS + Interview Studio.
- `27-executive-os.md`: decision layer, metric contract, partner scorecard, marketplace decision layer, AI cost model, 35-row gap matrix.
- `03-student-os.md` gained the Master plan contract: study-block command, scheduling validation, priority, grade calculator, heatmap, balanced planner, ICS export.

Reference code supplied with the specs lives in `docs/system/` as `*.js.txt` (rename to .js). Prototype screens to compare against: `#/student/masterplan`, `#/faculty/os`, `#/executive/decisions`, `#/os/completion`, `#/student/interview`, `#/os/repo` (prototype vs repo @ 57185b085d88). Start-to-finish map: `guidelines/connections.html`.

Still required from you (not automatable): signing data agreements, legal review, approving every pull request, anything touching production or money.
