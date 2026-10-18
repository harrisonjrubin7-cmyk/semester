# Delivery-management layer

Source: the "continue" delivery-management specification (PDF, 11 pages). This folder holds the records that turn the existing artifacts into one execution system: capability increments, a dependency graph, quality gates, decision rights, risks, artifact status, finance controls, and the expansion scorecard.

Check the records with:

```bash
node scripts/check-delivery.mjs          # exit 1 on errors; warnings are open gaps
node --test scripts/check-delivery.test.mjs
```

## Choices made

- **JSON, not YAML.** The spec's file names end in `.yaml`. The repo has no YAML parser on its root toolchain and the spec does not justify adding one, so the records are JSON with the spec's content and key names. Renaming to YAML later is mechanical.
- **Capability key `registration.readiness`.** The spec says `registration_readiness`; the platform registry at `packages/platform-control/registry/capabilities/registration.readiness.json` is the source of truth, so the registry key is used.
- **Dependency statuses are `proposed`.** Nothing in the repository proves a component's delivery state, so none is claimed. Owners update them as evidence lands.
- **Existing governance is linked, not duplicated.** `docs/DECISION-RIGHTS.md`, `docs/DEFINITION-OF-DONE.md`, `LAUNCH-RISK-REGISTER.md`, and `docs/operating-model/QUALITY-MANAGEMENT.md` already exist. These records add the spec's structure beside them.

## Status against the spec's twelve execution items

| # | Item | Status |
|---|---|---|
| 1 | Publish the operating model; require capability keys | Partial. Model published and every increment card carries `capability_key`. No PR check enforces it yet. |
| 2 | First increment cards | Done as records. RDY-INC-003 is `shaped`; RDY-INC-004 to 007 are `proposed` stubs (scope not in the source). |
| 3 | Machine-readable dependency graph; block bypass of hard dependencies | Done for direct hard dependencies (`check-delivery.mjs`). Transitive dependencies are not checked. |
| 4 | Adopt six quality gates in PRs, release reviews, pilot activation | Not done. Gates are defined in `quality-gates.json`; nothing runs them yet. |
| 5 | Record decision rights with institution names | Blocked on the institution. Every approver is `UNASSIGNED`. |
| 6 | Populate risk register; schedule review during hypercare | Register populated. Review date and owner are `UNASSIGNED`. |
| 7 | Definition of ready before development | Defined in `operating-model.json`. Not enforced beyond the state machine. |
| 8 | Definition of done before release-ready | Defined. Not enforced. |
| 9 | Artifact registry in the master-control surface; flag expired critical documents | Partial. One artifact (ART-RDY-011) registered and recorded as `missing`. Master-control surface not built. |
| 10 | Finance-control baseline before any payment or ledger work | Done as a baseline record. No finance workflow exists here. One principle is cut off in the source text and is marked for completion. |
| 11 | Pilot expansion scorecard at end of first observation period | Defined; `status: not_run`. No pilot period has started. |
| 12 | Activate cohorts on evidence, not progress labels | Defined as hard stops and a score policy. Not applicable until a pilot runs. |

## What blocks RDY-INC-003 from `approved_for_build`

The validator reports these hard dependencies below `approved_for_build`: identity_context, source_authority_register, SIS_adapter, readiness_case_workflow, audit_event_store, alerting. The card also has four open gaps: no source-authority record, the runbook ART-RDY-011 is registered as `draft` (its roles are TBD and its dependencies are unregistered), no release evidence, and no named institution owner. The UI state specification is now linked (`docs/pilot/registration-readiness/connection-states.yaml`).

## Not done

- No deployment or launch. The spec's launch gates (GATE-05, pilot activation) need an institution, named owners, and a runbook that does not yet exist. Nothing was deployed to any environment.
- The spec's second document, the "Ship Program and Launch Runbook" HTML, was not provided; only the PDF was available.
- The checker is not wired into CI. Add it to the pull-request workflow once owners accept it.
