# Integration and permission evidence — 28 Oct 2026 (owner sources S-92, S-93)

S-93 §8 names the next artifact: "a connection-and-permission evidence matrix tied to the actual Zite applications and backend". S-92 §1–3 and S-93 §2–3 describe the exchange pipeline every inbound integration must pass through. This increment builds the first real use of that pipeline (a roster import) and the permission evidence register.

## Roster-import gateway, shadow mode (`lib/rgwMigration.ts`, `lib/rosterRules.ts`, `api/rosterImport.ts`, Console → Roster import)

The pipeline follows S-93 §3:
- **Authenticate:** an integration administrator holding `connector.manage`.
- **Resolve the institution:** always from the caller's membership and the approved connection, never from the payload (S-93 §3).
- **Validate:** parse OneRoster-shaped CSV; refuse malformed files as a whole; keep only allowlisted columns and name the dropped ones (never their values).
- **Map identities:**
  - a person matches only through an approved link, or exactly one email match among the institution's own members;
  - a class matches only through an explicit link to one of the institution's sections;
  - anything else is quarantined with a reason.
- **Transition:**
  - request key plus file hash: a retry replays the batch, and the same key with a different file is refused;
  - duplicates inside a file are flagged;
  - an older update never overwrites a newer one;
  - a second source id for the same person and class is quarantined rather than becoming a second seat.
- **Record:** append-only per-row outcomes and an audit event.
- **Reconcile:** "Compare with Semester" reports students and teachers that match, appear only in the source, or appear only in Semester.

**Shadow only.** No enrollment is written. The table cannot be switched out of shadow mode (constraint), matching S-91 §10: compare shadow outputs before any authorized system-of-record switch.

**Two-person rule.** A connection is approved by a different integration administrator (function check plus table constraint).

**Not claimed:** OneRoster conformance or certification, Edu-API support, LTI. The format is described as "OneRoster-shaped CSV" everywhere.

Evidence:
- `dbchecks/rosterGateway.ts`: 23/23.
- The first run found two real defects, both fixed before commit:
  - a person link was written before the rest of the row had been validated;
  - a second enrollment id for the same person and class would have been staged as a second seat.
- Mutants:
  - guessing an ambiguous identity fails R7/R8;
  - letting an older update overwrite fails R17/R18/R20;
  - allowing a second seat fails R18;
  - allowing self-approval is still stopped by the table constraint.
- `tests/rosterRules.test.ts`: 4/4 (quoted fields, CRLF, byte-order mark, allowlist, malformed files).
- **Live:** both real accounts (faculty, student) are refused by every action ("Your role does not allow this").
- **NOT RUN:** the permitted path with real integration administrators. It needs two staff accounts holding `connector.manage`, because approval needs a different person.

## Permission evidence register (`lib/permissionEvidence.ts`)

S-92 §7's 13 "tests to execute first", each with the expected decision and the repeatable check that proves it. `tests/permissionEvidence.test.ts` requires every cited check label to appear verbatim in the cited file. A renamed or deleted check breaks the register instead of leaving a stale claim.

| Status | Tests |
|---|---|
| Evidenced | P05 cross-institution hold id, P06 release without authority, P07 restricted roster fields, P12 replay and out-of-order |
| Partial | P01 another student's submission, P10 expired delegate, P11 cross-institution webhook, P13 AI retrieval |
| Untested (code exists, no repeatable check) | P02 instructor from another section, P03 unreleased grading, P04 private note in search |
| Not built | P08, P09 (LTI Advantage) |

A one-off live observation is recorded as a gap, not as evidence. S-92 notes: "An administrator testing every path cannot establish ordinary-user isolation."

## Not done from S-92/S-93 yet

- The connection register has 13 fields per S-93 §3. The roster connection carries the core ones (institution, owner, standard, source, direction, authority, mode, approval). Field allowlists, credentials and rotation, schedules, and retirement are not modelled.
- Untested rows P02–P04 need repeatable two-account checks.
- Zite `defaultPolicy` is still unverified (S-92 §6). It is not changed blindly.

S-94 (public website) is a separate track, not started.
