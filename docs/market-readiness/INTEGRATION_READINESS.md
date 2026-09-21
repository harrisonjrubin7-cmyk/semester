# Integration Readiness

**Status: `IN_PROGRESS`** — the strongest area in the repository.

## Architecture that already exists

**`packages/institution`** — the gateway contract. 456 lines defining:

- `UNIVERSITY_AREAS`: 37 service areas, flat rather than nested, on the stated
  reasoning that every grouping puts something in the wrong box for somebody
- `UNIVERSITY_ROLES`: `student`, `faculty`, `advisor`, `admin`, `payer`, `staff`
- A transport shape and validator shared by browser, gateway and tests, so a
  copy in any of the three would drift

Deliberately separate from `packages/contract` (the academic record), so that
a change to how a note syncs cannot alter what is sent to a registrar.

**`app/server/institution/`** — the gateway itself:

| File | Role |
| --- | --- |
| `gateway.ts` | auth, rate limiting, two-phase action, journal, error flattening |
| `auth.ts` | network-validated identity, roles from `app_metadata` |
| `journal.ts` | encrypted durable action log with `uncertain` + reconcile |
| `adapter.ts` / `adapters.ts` | the adapter interface and registry |
| `sandbox.ts` | a fake institution for tests |
| per-area | `registration`, `money`, `housing`, `advising`, `athletics`, `career`, `clubs`, `family` — each with tests |

## The adapter registry is empty, on purpose

No real institution is reachable. `packages/institution/src/index.ts` states
it: *"This is a transport shape and a validator, not an integration."*

**This is the correct posture and must be preserved.** Every screen built on it
keeps saying so: a plan, a draft, an imported seat count and an estimate are
preparation, and are never drawn as an official submission, a live record, an
enrolment or a payment.

## What the journal gets right

An action is recorded *before* it is attempted. If the outcome is unknown the
record is `uncertain`, and **nothing transitions out of `uncertain` on a timer
or a retry** — only by asking the institution what happened. This is what
stops a dropped connection from double-dropping a course.

## Missing

- No LMS normalisation layer (Canvas, Brightspace, Blackboard, Moodle)
- No SIS normalisation layer
- No source-of-truth field provenance
- No integration conflict precedence rules
- No integration status dashboard for university admins
- No incremental sync engine

## Blocked

Real adapters are **`BLOCKED`** on institutional API approval and vendor
agreements. This is a genuine external blocker, not a gap to code around. The
correct work while blocked is normalisation interfaces and the sandbox — both
of which the tree already has the shape for.
