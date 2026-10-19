# Semester mainframe — how to start

## 1. Set up (from the repo root)

```bash
git clone https://github.com/harrisonjrubin7-cmyk/semester.git   # new checkout only
cd semester
git status --short            # inspect before changing anything
git branch --show-current
git switch -c audit/semester-mainframe-reconciliation   # after reviewing local changes
mkdir -p docs/specifications docs/mainframe
cp ../design/handoff/specifications/*.pdf docs/specifications/
cp ../design/handoff/mainframe/EXECUTION_PROMPT.md docs/mainframe/EXECUTION_PROMPT.md
```

Never put credentials, production exports, student records or private financial information in `docs/specifications/`.

Don't run `npm ci` or Supabase commands yourself first — let the agent identify the package manager, workspace, scripts and intended environment.

## 2. Start the agent (Claude Code or Cursor Agent mode)

```text
Read docs/mainframe/EXECUTION_PROMPT.md and the specifications in
docs/specifications/.

Follow the repository's existing instructions.

Execute "START NOW": reconcile the architecture against actual code, then
implement the first safe local foundation increment with tests.

Do not deploy, push remote changes, apply remote migrations, send messages,
or perform financial/academic actions.

Return the evidence-based batch report and update SESSION_HANDOFF.md.
```

## 3. Continue in bounded batches

```text
Continue the Semester mainframe implementation.

Read:
- Repository instructions
- docs/mainframe/SESSION_HANDOFF.md
- docs/mainframe/EXECUTION_BACKLOG.md
- docs/mainframe/READINESS_REGISTER.csv
- The current Git diff

Select the next dependency-ready task.

Implement one complete, reviewable increment using existing canonical systems.
Add authorization, failure-state, and acceptance tests relevant to the change.
Run the applicable checks and update the evidence records.

Do not bypass failing gates or substitute placeholders for working behavior.
Do not perform external or production mutations without specific approval.
Return the batch report and the next task.
```

## Design-project evidence the agent may use (verify, don't trust)

- `design/docs/system/ROLE_SYSTEM_RECONCILIATION.md` — read-only GitHub audit: existing `app_roles`, `app_capabilities`, `role_grants`, `private.has_capability`, and which design migrations duplicate repo migrations.
- `design/handoff/semester-platform/supabase/migrations/010–120` — **reference specs only; do not apply.**
- `design/ui_kits/mainframe/index.html` — the nine layers linked to every prototype (behavioural reference, not code to ship).
- `design/ui_kits/journey`, `registrar-console`, `role-workspaces` — the registration-readiness journey end to end, for the Phase 2 slice.

Key rule: map the entire architecture, but implement it through complete, tested journeys — not mass-generated tables, empty consoles and disconnected screens.
