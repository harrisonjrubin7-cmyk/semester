# 00 — Executive decision record

Pilot: registration_readiness · Tenant: named_institution · Status: **pending** (no observation window has closed) · Decision date: _pending_

## Decision

Options: renew unchanged · renew with remediation · extend observation · expand cohort · add source · conclude and offboard.

A signed decision must use a canonical value from `app/src/lib/gtm/pilot.ts`: `convert`, `expand`, `pause` or `stop`. The other options are non-final and cannot be signed as a `PilotDecision`; record them here as a pending recommendation.

Decision: _pending_

## Evidence this decision rests on

Links to files 01–08 and 10, and the recommendation in file 09. A decision is not ready to sign while any mandatory field in those files is still `_pending_` or unsupported by evidence. File 10's offboarding completion is recorded after the decision, so it is excluded from this check.

## Hard stops checked

These gate a `convert` or `expand` decision. A `pause` or `stop` may be signed while any of them is open, because the stop and offboarding path runs regardless of commercial value.

- [ ] Agreed targets met for the piloted scope (file 02 result recorded, not only the outcome evidence)
- [ ] No unresolved critical access finding
- [ ] No unresolved critical accessibility finding
- [ ] No unresolved critical or high-severity security or privacy finding
- [ ] Authority known for every required source
- [ ] Safe-off state operated in a drill
- [ ] No repeated student confusion about enrollment

## Signers

- Executive sponsor (required for every signed decision): pending
- Institution business owner: pending
- Semester product owner: pending
- Semester security owner: pending
