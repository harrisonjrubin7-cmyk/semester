# Decision and productivity workspace

Access: **Pathway → Decisions & productivity**. Global Quick Add offers **Capture for later**.

## Implemented

- Student-owned decisions: goals, three options, editable weighted criteria, evidence and freshness, transparent coverage, readiness, questions, pause, revisit, reflections and independent snapshots. No automatic choice.
- Owned assumptions: scenario preview, institution inputs read-only, source-check invalidation after edits, saved preferences. Dates use the student's local calendar day and reject impossible dates.
- Private capture and six-state inbox, 21 preparation templates, editable preparation queue, local text search, explicit source authorization, focus timer and weekly reset.
- Account-scoped device library, damage-preserving recovery, validated merge import and whole-workspace backup.
- **Backup:** private account-backed cloud load/review/restore/save/delete. Revision-based writes reject another device's intervening changes. Device backup is exported before replacing local data. Tenant attribution requires active membership. This is explicit synchronization, not background autosave.
- **Connections:** assistant-generated drafts and semantic retrieval across up to 20 selected authorized captures. Exact outgoing context is reviewed first; decision reflections/history are excluded. Semantic result IDs and verbatim excerpts are checked against selected sources. Drafts stay editable and require a separate save. Personal accounts use the existing configured assistant/spend controls; configured institutions use the existing approved-source policy gateway and reject unapproved sources.
- Reviewed packet exports as TXT, PDF and DOCX. Existing connected Google/Microsoft accounts can receive the reviewed DOCX through their existing upload route. No email is sent.
- Reviewed weekly study blocks (1–12 weeks), appointment-conflict preview and Calendar application. Changed decision assumptions invalidate the preview. Existing class/travel conflicts still need Calendar review; this does not infer course eligibility or alter registration.
- Revisit ICS with 24-hour and one-hour alarms; connected Google/Microsoft calendar event creation. Calendar apps control delivery of imported alarms. These are exported events, not a hosted decision-specific subscription or scheduled server push service.
- Authenticated public source check: .edu or configured approved hosts, HTTPS only, public DNS, validated redirects, 512 KB/8-second limits. Reports availability and exact-excerpt presence without certifying policy or updating evidence automatically.
- Optional Chrome MV3 browser capture extension: active page only, selected text on request, preview before private capture, no assistant authorization by default. Incoming context travels in the URL fragment, is scrubbed before rendering and retained only in the current browser session until saved/discarded.
- Opt-in institution count reporting through an administrator-only aggregate RPC. Only active consenting members count; cohorts below 10 are suppressed. No student content or identities appear in the response. Account deletion cascades the cloud workspace.

## Deployment and validation

Cloud migration `20261001153124_productivity_workspace.sql` is the canonical implementation recorded by configured Supabase project `lzrqvlugnawcgywkhqlz`. Earlier preview branches recorded versions `20261001152756`, `20261001160447`, `20261001160755`, and the superseded index repair `20261001184000`; the repository retains those versions as statement-free compatibility markers so both ledgers reconcile without executing the schema twice. `productivity-sourcecheck` deployed ACTIVE with custom JWT verification on every POST (platform verification off for CORS preflight). Rollback-only SQL checks verify account isolation, stale revision rejection, deletion protection, and rejection of unauthorized aggregate access without retaining fixtures.

Types/build/lint, institutional checks, export/privacy/semantic/parser tests, cloud transport tests and mounted preparation tests run from `app/`. Full normal and shuffled suites must be recorded in the PR after the final branch update. The rollout-publication tests depend on `/workspace/scratch/outputs/semester-institutional-rollout`, which is absent here; no publication evidence is fabricated.

The front end from PR #1067 is merged into `main`; that fact alone is not evidence of a current production deployment. Live provider operations require the student's connected account. Live model output requires a configured assistant or institutional gateway with approved source IDs. End-to-end sign-in/provider tests have not been claimed using real student accounts.

## Bundle acceptance

Quick Add and the decision workspace load only when opened, preserving the existing initial-load and Pathway budgets. The Export route budget increases from 60 to 69 KiB (including the existing ten-percent measurement headroom) because private backup export now includes the validated productivity workspace parser; the measured combined route is 60.9 KiB. No initial-load or Pathway budget is raised.
