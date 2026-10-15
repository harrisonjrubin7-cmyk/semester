# Stream 26: Faculty & Teacher OS + Semester Intelligence (three modes)

Source: `docs/system/Faculty and Teacher OS with Semester Intelligence.pdf`. Prototype: `#/faculty/os` (`ui_kits/semester-app/FacultyOS.jsx`). Proposed specification; reconcile with existing Course Studio, gradebook and TA screens before adding routes.

## Order
1. Finish existing teaching workflows first: faculty AI-policy publication, roster management, class communication (gap register).
2. One proof per mode:
   - Executive assistant: daily briefing + one approved calendar change with receipt.
   - Research partner: verified claim-to-source matrix with full-text vs abstract-only flags.
   - AI TA: answer a course question, refuse an assessed answer, escalate ambiguity to the instructor queue.

## Rules
- Every briefing item keeps five stages apart: observed fact → interpretation → suggested action → approved action → confirmed outcome.
- One gateway, three modes. Tenant + role + relationship + policy + classification checks, then mode-specific sources only.
- Prepare ≠ send: `draft_*` and `publish_*` are separate capabilities. Publishing still previews recipients and content.
- Source collections: (1) student-visible materials, (2) instructor-only keys/assessments, (3) teaching-team materials, (4) submissions + official records, (5) student-private notes/AI chats. Student-facing retrieval never touches (2). Faculty never see (5) by default; aggregate themes only.
- No student records to AI providers until that policy is formally changed. Grading help may propose feedback; never assigns, releases or denies grades, or infers misconduct.
- Course AI mode (Off / Explain only / Feedback on drafts) enforced at the model/tool call; never more permissive than institution rules.
- Memory: personal, course, research separate; institutional records read live, never stored. Inspect, delete, disable. Course end removes student context.
- TA lifecycle: provision → scoped grant → training → assign → calibrate → draft → exceptions → authorized release → reconcile → sunset.
- No single confidence score: show sources, official vs provisional, supported vs inferred, unavailable info, claims needing confirmation.

## Capability record (each assistant skill)
Purpose · permitted roles · resource relationships · allowed sources · excluded data · allowed tools · approval requirements · output and provenance · evaluation cases · failure/escalation · budget/runtime · memory rules · audit/retention · activation gate · owner.

## Screens (proposed) and completion evidence
Faculty Today (freshness + permission tests) · Review and approve (approval binding, replay) · Course Studio (draft/published separation) · Course AI rules (enforced at invocation) · Teaching team (scope + revocation) · Assessment review (human authority) · Course questions (answer-key isolation) · Office hours (conflicts) · Research project (source + collaborator isolation) · Literature matrix (citation grounding eval) · Analysis workspace (execution receipts, sandbox) · Professional portfolio (verified provenance) · Intelligence settings (revocation, retention, kill switch).

K–12 teacher workflows: separately reviewed configuration (minors' data, family access, district authority).

## Feature matrix, privacy, grading (Oct 7 2026)
Source: `docs/system/Faculty OS Feature Matrix and Workflow Demos.pdf`. Prototype tabs: Feature matrix, Research privacy, Grading.
- Deployment principle: prepare → review → authorize → execute → reconcile.
- Executive assistant levels: read/prepare · approved exact action · bounded standing rule (never moves classes, deadlines, student appointments, or sends messages). Calendar changed between preview and write → stop and refresh.
- Research data classes: public, licensed, confidential, restricted participant (external blocked), student-linked (never to providers), synthetic/approved de-identified. Each run shows a privacy receipt (project, class, sources, environment, provider, context sent, retention, output class, approval).
- Grading = three capabilities: deterministic scoring (provisional), AI-assisted review (human accepts), official release (faculty decision + audit + passback + reconcile). Sandbox: no credentials, network off, resource limits, versioned tests; timeouts and infra failures never become penalties; partial passback shown as pending, not failed.
- AI TA acceptance: no answer-key retrieval; embedded instructions can’t expand tools; Off blocks invocation; Explain-only never gives a full assessed solution; expired membership blocks retrieval; provider outage → clear fallback.
- Open conflict: provider-exclusion red-team claimed tested in one doc, not run in another. Unverified until a staging report exists.
