# Workflow Builder

Item 3 of the platform brief of 30 September
([`expansion/Platform-Operating-Model-Configuration-Workflow-Governance-and-Proof.pdf`](expansion/Platform-Operating-Model-Configuration-Workflow-Governance-and-Proof.pdf)):
*"a visual and API-backed system for approved workflows … the policy engine
should evaluate deterministic rules, not vague AI judgments."* Decision:
[D-1018](DECISION-LOG.md).

## What is built

`workflow_versions` (`supabase/migrations/20260930231000_workflow_builder.sql`),
`lib/workflow/` (spec, engine, templates, client), and a **Workflows** tab on
University behind `VITE_WORKFLOW_BUILDER` (off by default).

A **definition** is: a title, an ordered list of steps (each a kind, an owner,
an optional wait in days), a list of eligibility checks (a fact, a comparison,
a value, what to tell the student, what to do next), and the office it hands
off to. The ten workflows are the ten the brief lists; each has a starting
template (`lib/workflow/templates.ts`) whose credit numbers and office names are
placeholders a school changes.

| Rule | Where it is held |
|---|---|
| Steps, owners, facts and comparisons are closed lists; there is no expression a school writes | `private.workflow_spec()` and `private.workflow_problems()`; `lib/workflow/spec.ts`; `spec.test.ts` holds them equal |
| The student confirms before any official handoff; a handoff names its office; a workflow ends by completing | the same, codes `confirm_before_handoff`, `handoff_missing`, `last_step_complete` |
| A rule may read eight facts, none a grade, balance, diagnosis, disciplinary or immigration detail | the fact list; a test holds it to the brief's own prohibited-fields example |
| Published versions are numbered, never edited or deleted; a rollback is a new draft | unique indexes, the guard trigger, RLS |
| Whoever drafted a definition does not publish it; a publisher alone cannot rewrite a draft | `private.workflow_guard`; `workflow-builder.check.sql`, on an account holding both roles |
| Every draft, save, publish and discard is audited with the actor's grant | `tenant_policy_audit_event` |

### The policy engine

`evaluate(definition, facts)` runs the checks in the order written. Each passes,
fails, or **cannot be told** because the fact is not known. Not knowing is never
a pass and never a failure: `eligible` is `true` only when every check passed,
`false` when one failed, and `null` otherwise, and the student is told what
could not be checked and which office can check it against the official record
("human takeover when the system is uncertain"). The same definition and facts
give the same answer; nothing calls a model.

The builder's preview runs this engine on facts typed into the screen, so a
school sees what a student would be told before publishing. Nothing typed
there is stored.

## What it does not do

- **It holds definitions, not students.** No request, answer or student is
  stored. A workflow *instance* — a student going through one, with its
  confirmations, staff reviews, SLAs and escalations — is not built. That is
  the next slice, and it needs a student-facing screen, a home for the facts
  and the data-governance review that goes with them.
- **Nothing runs these definitions yet.** The screen says so on its first
  line; students see no change.
- **The facts have no source.** `evaluate` takes the facts it is handed. Where
  each one comes from is an integration's business, with its own field
  allowlist.
- **No handoff writes into an official system.** A handoff step names an
  office and is a pointer; the office keeps the record.
- **No visual canvas.** It is a form, not a drag-and-drop editor.

## Where the rest of the brief stands

See [`CONFIGURATION-STUDIO.md`](CONFIGURATION-STUDIO.md) when it has landed
(#1011); the Configuration Studio and this builder share the same mechanics
(drafts, a second person, numbered versions, an audit) and are independent
changes.
