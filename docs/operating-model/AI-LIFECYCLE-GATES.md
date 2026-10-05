# AI lifecycle gates

**Code: `app/src/lib/governance/ai-lifecycle.ts`.** The [AI governance board](AI-GOVERNANCE-BOARD.md) decides. This
says what a use case must be able to show at each gate before anyone decides, and in what order. Each AI capability
is a governed product with a lifecycle, not one chat feature.

The gates follow the four functions of the NIST AI Risk Management Framework 1.0: Govern, Map, Measure and Manage.
The framework is voluntary. The rules below are not.

## The gates

| Gate | Name | NIST function | Decision | Required evidence |
| --- | --- | --- | --- | --- |
| G0 | Intake | Govern | Is this a permitted Semester use case? | User job, Intended outcome, Prohibited scope, Owner |
| G1 | Risk map | Map | Are data, policy, authority and failure boundaries understood? | Data flow, Source inventory, Risk assessment, Policy mapping |
| G2 | Build | Map | Can engineering begin? | Architecture, Threat model, Test plan, Fallback design |
| G3 | Pilot | Measure | Is it safe for a named cohort? | Evaluation, Red-team, Accessibility test, Incident and support runbook |
| G4 | General availability | Manage | Is it reliable and supportable across enabled tenants? | Pilot outcomes, SLOs, Monitoring, Documentation, Approval |
| G5 | Renewal or retirement | Manage | Continue, improve, limit or remove it? | Quarterly risk, value, cost and incident review |

**Gates are sequential.** Evidence for a later gate does not count while an earlier one is open: `standing()` stops
at the first incomplete gate. A pilot that skipped its risk map is not a pilot.

**G5 comes round every quarter.** A use case whose last review is more than 92 days old is due again.

## The AI release gate

G3 needs every one of these as well as its own evidence:

- Intended purpose documented
- Data flow approved
- Authorized sources enforced
- Course and institution policy enforced
- Citations tested
- High-risk requests safely redirected
- Prompt-injection tests pass
- User can inspect and delete applicable history and output
- Output labelled as a generated draft where appropriate
- No consequential write without exact review and confirmation
- Monitoring, feedback and kill switch exist

The kill switch is the existing `kill.ai_generation` flag, not a new mechanism. The test fails if that flag is
renamed.

## Refused at intake

A use case that would do any of these does not enter the lifecycle, whatever evidence it brings:

- Autonomous registration
- Official degree certification
- Financial-aid decisions
- Disciplinary judgments
- Health decisions
- Opaque risk scoring
- Automated hiring decisions
- Ranking students for employers
- Auto-publishing institutional policy
- Unapproved production changes

## Where to start

Bounded, source-aware use cases, in order:

1. Explain an approved course concept from selected source material
2. Create a reviewable study plan from confirmed deadlines
3. Generate practice questions with citations and feedback
4. Draft an advisor agenda from student-selected planning details
5. Explain requirement and course-option implications, stating estimates and linking to official paths

## What each function asks for

### Govern

- Named accountable executive
- Approved provider and model inventory
- Data-use and retention policy
- Course and institution policy hierarchy
- Human-review requirements
- Vendor and subprocessor review

### Map

- Use-case registry entry
- Users, roles and context
- Data categories used
- Authorized source types
- High-risk outcomes and failure modes
- Academic-integrity, accessibility and fairness risks
- Fallback workflow

### Measure

- Source-grounding rate
- Citation correctness
- Permission and policy-block accuracy
- Prompt-injection test results
- Hallucination and unsafe-output reports
- Latency and cost
- User usefulness feedback

### Manage

- Feature flag and kill switch
- Model routing and rate limits
- Prompt and policy versioning
- Red-team regression suite
- Incident response and customer notification
- Corrective-action tracking
