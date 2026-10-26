# Action Center vertical slice (reference)

From `uploads/Show me the code or schema for the Action Center_D.pdf` (Oct 2026). **Nothing here has been applied, run or deployed.** These are reference drafts to reconcile with existing primitives, not a second platform.

| File | What it is |
|---|---|
| `001_action_center.sql.txt` | Projection schema: items, preferences (presentation only), processed_events (dedupe). RLS on, no client access. |
| `reduce-action.ts.txt` | Pure reducer plus a transition guard and revision-gap check, both added beyond the PDF draft. |
| `101_controlled_actions_fix.sql.txt` | Proposed fix to `100_controlled_actions.sql.txt`: accepted ≠ confirmed, and idempotency scoped by caller and request hash. |
| `contracts/` | User-supplied OpenAPI 3.1 draft (sync batches, jobs, Action Center items and preferences), 60-field data dictionary, synthetic batch, and recorded schema results. Only structural JSON Schema checks have been run; no OpenAPI linter, server or semantic validation yet. |

## Verified against this repo
- `handoff/semester-platform/supabase/migrations/100_controlled_actions.sql.txt` line 89 sets `status = 'executed'` in the same call that inserts the outbox row. **Confirmed issue.**
- Line 46 has `idempotency_key text not null unique` (global), and line 57 looks up by key alone with no hash comparison. **Confirmed issue.**
- Ranking should reuse `handoff/semester-core/nextaction.ts.txt` through an adapter. Don't start a second ranking engine.

## Ownership
Domain facts belong to the source systems. The projection belongs to the Action Center service. Pin, snooze and hide are the student's and are presentation only. Snoozing a hold reminder never changes the hold.

## Minimum tests (run live in the prototype)
These are simulated in the bespoke Action Center screen (`ui_kits/every-screen/index.html#B/1`, “How this list is built” tab). They pass against a JS port of the reducer only, not a database:
duplicate delivery, older revision, tenant mismatch, required item can't be hidden, snooze doesn't touch state, submitted ≠ fulfilled, unknown stays unresolved, fulfilled needs a receipt, terminal state needs a correction to reopen, revision gap is quarantined, and the marker, projection and intent commit together.

## Next-session plan (from the PDF)
1. Inspect and reconcile with existing tables, grants, outbox and nextaction.ts.
2. Fix command semantics (file 101).
3. Adapt the projection schema: FKs, context constraints, reviewed RLS/RPCs.
4. Build the transactional consumer: validator, guard, dedupe, snapshot recovery, notification intents.
5. Connect the UI using existing components (SourceBadge, ActionPreview, receipts).
6. Draft institutional review artifacts: authority matrix, AI eligibility, activation checklist.
7. Run the vertical-slice suite: authorization, projection, command, execution, privacy, accessibility, lifecycle, AI.
8. Record status as seven separate fields: specified, designed, implemented, tested, deployed, institution-authorized, production-enabled.
