# Registration readiness: pilot operating package

Source: the pilot-package PDF "continue expanding providing artifacts details"
(30 ordered artifacts, plus a repo map). This folder holds the artifacts in this
repository. It does not create the separate `semester-platform/` tree the PDF's
repo map describes. That layout was not adopted, because the readiness code
already lives under `app/server/institution/` and `app/src/components/`.

## What is here, and what is not

Status key: **written** = the artifact exists and matches the PDF's content.
**open** = not written, because the PDF does not specify the content, or
because it needs a human decision first.

| # | Artifact | Status | File / blocker |
|---|----------|--------|----------------|
| 1 | component-passport.schema.json | open | Derivable from the passport fields. Next slice. |
| 2 | registration-readiness.passport.yaml | written | `registration-readiness.passport.yaml` (owner names TBD) |
| 3 | connection-states.yaml | written | `connection-states.yaml` |
| 4 | source-verification.ts | open | Types are in the PDF. Needs a `.ts` file, a test, and a typecheck. Next slice. |
| 5 | source-freshness-policy.yaml | open | Needs freshness thresholds. The PDF does not give them. Decision needed. |
| 6 | data-classification.yaml | open | Needs classification levels. The PDF does not give them. Decision needed. |
| 7 | feature-flags.yaml | written | `feature-flags.yaml`. Spec only; the flag is not wired into app code. |
| 8 | environment-promotion.yaml | written | `environment-promotion.yaml` |
| 9 | observability.yaml | written | `observability.yaml`. Alert thresholds marked TBD. |
| 10 | reconciliation-policy.yaml | written | `reconciliation-policy.yaml`. DDL is reference only, not a migration. |
| 11 | controlled-actions.yaml | written | `controlled-actions.yaml` |
| 12 | ai-boundary.yaml | written | `ai-boundary.yaml` |
| 13 | accessibility/readiness-evidence.yaml | written | `accessibility/readiness-evidence.yaml`. Status: not_started. |
| 14 | risk-register.yaml | open | No content in the PDF. |
| 15 | control-register.yaml | open | No content in the PDF. |
| 16 | readiness-event.schema.json | open | Derivable from the events list. Next slice. |
| 17 | receipt.schema.json | open | Derivable from the receipt fields. Next slice. |
| 18 | integration-adapter.schema.json | open | Derivable from the adapter contract. Next slice. |
| 19 | policy-decision.schema.json | open | Derivable from the policy-decision contract. Next slice. |
| 20 | audit-event.schema.json | open | Derivable from the audit fields. Next slice. |
| 21 | release-evidence.schema.json | open | Derivable from the go/no-go criteria. Next slice. |
| 22 | INC-READINESS-001.yaml | written | `INC-READINESS-001.yaml`. Named roles TBD. |
| 23 | launch-day-runbook.yaml | written | `launch-day-runbook.yaml`. Named people TBD. |
| 24 | go-no-go.yaml | written | `go-no-go.yaml`. Decision state: **pending**. |
| 25 | student-quick-start.md | open | Needs approved product copy. Note: `docs/launch/STUDENT-QUICK-START.md` exists on main for another launch and is not this pilot's copy. |
| 26 | registrar-training.md | open | Needs registrar workflow confirmed by the institution. |
| 27 | support-macros.md | open | Needs institution support paths. |
| 28 | institution-communications.md | open | Needs institution sign-off. |
| 29 | pilot-results-template.md | open | Template only. Next slice. |
| 30 | post-launch-review.md | open | Template only. Next slice. |

Count: 12 written, 18 open.

## Decisions this package depends on

- **Location.** Artifacts live in this repo, not in a new `semester-platform/`
  tree. See the decision record for this change.
- **Pilot institution.** No institution is named in the repo. Every owner field is
  TBD. Go/no-go cannot pass until named people fill them.
- **Freshness and alert thresholds.** Not specified. Marked TBD in the YAML.
  Until they are set, the stale-source and reconciliation alerts cannot fire
  against a real limit.
- **Production.** Not approved. `go-no-go.yaml` is pending, and the PDF makes a
  signed go/no-go a requirement for production.

## Existing code this spec describes (not verified against it yet)

`app/server/institution/readiness-service.ts`, `registration-readiness-commands.ts`,
`readiness-repository.ts`, and `app/src/components/RegistrationReadiness.tsx`
already exist on `main`. These artifacts have not been reconciled with that code.
Checking the code against `connection-states.yaml` and the state vocabulary is
an open item.

## Pilot operating plan (`operating-plan/`)

The pilot operating plan brief turns this package into one executable cadence. Its
files are in `operating-plan/`. Per D-1537, the brief's suggested top-level `evidence/`
and `registry/` paths are mapped into this folder, not created as new trees.

| Object | File | Notes |
|--------|------|-------|
| Pilot identity and boundary | `pilot.yaml` | Institution TBD. |
| Success questions and indicators | `success-plan.yaml` | |
| Scope record | `scope-record.yaml` | Unsigned. Tenant, term, sources TBD. |
| Five-stage launch cadence | `launch-cadence.yaml` | All stages not started. Dates TBD. |
| Roles and decision owners | `roles-and-escalation.yaml` | Named people TBD. |
| Escalation (P0/P1/P2) | `escalation-matrix.yaml` | Response targets TBD. |
| Student journey and copy | `student-journey.yaml` | Copy is draft. Blocked, unknown, failed, and cancelled copy not in the brief. |
| Staff workflow | `staff-workflow.yaml` | |
| Hypercare | `hypercare.yaml` | Duration and attendees TBD. |
| Daily pilot health (template) | `daily-pilot-health.yaml` | Placeholder values. |
| Measurement plan | `measurement-plan.yaml` | Each metric has the seven reporting fields. |
| Change freeze | `change-freeze.yaml` | |
| End-of-pilot decision | `end-of-pilot-decision.yaml` | |
| Activation gate (REL-READINESS-001) | `activation-release.yaml` | Pending. None of the referenced `EVD-*` IDs exist on main. |
| First two weeks | `first-two-weeks.yaml` | All steps not started. |

Not done, and blocking activation: a named institution and tenant, signed scope,
named owners, dates, approved copy, evidence records for every `EVD-*` ID, and the
`CAP-REG-001` capability definition. No pilot has been activated and nothing has been
deployed.

## Verification

Run from the repo root:

```bash
python3 scripts/validate-pilot-artifacts.py   # parses every YAML file in this folder
```

The script checks that every YAML file parses. It does not check the content
against the PDF, and it does not check any app behavior.
