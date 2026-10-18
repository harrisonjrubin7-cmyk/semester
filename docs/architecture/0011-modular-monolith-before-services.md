# 0011 · Modularize the monolith in place; extract a service only when a stated trigger fires

**Status:** Accepted. Recorded as [D-1156](../decisions/D-1156.md). Plan:
[modularization/](modularization/README.md).

## Decision

Semester stays one deployable app (plus the edge functions and institution
gateway it already has) and is reorganized **internally** into bounded
domains with enforced dependency rules. A domain becomes a separate service
only when one of the triggers below is shown by evidence, and then by the
extraction path below, not by a rewrite.

## Options

| option | for | against |
|---|---|---|
| **A. Modular monolith, enforced boundaries** (chosen) | Keeps the app deployable and offline-capable (ADR 0001); the boundary work is the same work extraction needs; cheapest to reverse | Discipline must be enforced by tests, not by process isolation |
| B. Rebuild as services per domain (`services/*`, as the earlier audit proposed) | Hard isolation; independent scaling | Device-first working copy (ADR 0001) is the opposite of per-domain services; a rewrite has no safe coexistence; the pieces it would build already exist in `packages/institution`; the network becomes the first boundary for rules not yet separated in code |
| C. Leave as is | Zero cost | Every risk R1–R8 in the audit continues; institutional adoption needs one authorization path |
| D. Extract one service now (e.g. tasks) | Proof of concept | Personal tasks must work offline and signed out; a service adds latency and failure modes to the one path that must not have them |

## Why A

- **The boundary is the hard part and is missing.** 118/120 screens import
  `lib/`; 70 imports point up; 12 cycles. A network call placed on top of that
  would carry the coupling with it.
- **Most of what a service split would create already exists:** a decision
  point (ADR 0007), event envelope and outbox (0008), workflow machines (0009),
  an error envelope (0010), an institution gateway, a narrow Supabase seam (15
  files). They were not load-bearing because nothing forced use of them.
- **Device-first is a product requirement** (ADR 0001, ADR invariant 6): the
  app must be usable signed out and offline. Tasks, calendar, Today and
  identity therefore stay in-process by nature.
- **Reversibility.** If the boundaries are wrong, moving a folder is cheap;
  moving a service is not.

## Extraction triggers

Any one, with evidence recorded in a `D-<PR>` file:

1. **Scale or availability:** an SLO the shared deployment cannot meet for a
   domain, shown by measurement.
2. **Isolation required by contract or law:** residency, tenant isolation or a
   credential boundary that a shared runtime cannot give (payments scope, a
   school requiring its own data plane).
3. **Independent teams and cadence:** two or more teams blocked by one release
   train, measured as waiting time.
4. **Different runtime:** needs a language or hardware the app cannot host.
5. **Untrusted execution:** code that must not share a process with student
   data (the AI tool broker).

Already satisfied, and already separate: the AI gateway (4), billing and LTI
(2, edge functions), the institution gateway (2), integration tick (1).
Candidates in order of likelihood: integration hub, notifications. Not
candidates: identity, tasks, calendar, today, productivity.

## Extraction path (when a trigger fires)

1. The slice already has ports; add an HTTP adapter implementing the same port.
2. Run both behind a flag; compare (the parity pattern in the slice tests).
3. Move the data: new store, dual-write, backfill, verify, cut over; the old
   path remains for one release.
4. Delete the in-process adapter; the port is unchanged.

## Relation to D-1144

The CTO target-architecture pack (D-1144, status *proposed*) reaches the same
direction for the server side and also proposes three separate deployables
(`ai-gateway`, `integration-hub`, `sync-gateway`). This record does not
conflict: the first two are among those already satisfying a trigger (above),
and `sync-gateway` is for that pack's P-02 review to justify against these
triggers. This ADR covers the client tree and the existing gateway; it takes no
position on a container-hosted `core`.

## Consequences

- The earlier audit's repository layout (`apps/`, `services/`) is a destination,
  not a step. Nothing in this plan precludes it.
- Boundary rules are tests (`src/architecture/`), so they cost a failing CI run
  rather than a review.
- What would reopen this: a trigger above, shown; or the architecture tests
  proving unable to hold the boundary (e.g. a sustained pattern of ratchet
  edits upward).
