# Verification: what "verified" means here

> Code: `app/src/lib/verify/` · Decision: D-156

Semester's access rules are statements about *every* input: a kill switch beats
every other setting, a revoked share is never active again, a cell under the floor
is never shown. An example test checks the inputs somebody thought of. This checks
the ones nobody did, and shrinks a failure to the smallest case that still fails.

## What it is

`verify/property.ts`: about two hundred lines, no dependency. A seeded generator,
generators for numbers, lists, subsets and records that shrink toward the simplest
case, `assertProperty` for "for every input", and `assertMachine` for a model of a
system run through random sequences of actions, with the smallest failing sequence
reported. It is **deterministic by default**: a fixed seed, so the same suite gives
the same answer in file order and shuffled. `VERIFY_RUNS=20000 VERIFY_SEED=7 npm
test` searches harder, and a failure prints the seed that replays it.

## What it is not

It is **not a proof.** A property that holds for three thousand generated cases has
held for three thousand cases. Nothing in this repository is "formally verified",
and nothing here should be described that way. What it adds over an example test is
that it searches, shrinks, and can be pointed at a rule by name.

## The rules it holds, against the real code

| Area | Rule |
| --- | --- |
| Flags | A kill switch that applies beats every other setting; nothing is allowed without a verified school; an absent or off policy row is off; a temporary flag past expiry is off; an expired or unapproved scope never authorises; allowed means eligibility, course rule, capability, connection, role and cohort were all met; a denial survives each extra restriction. |
| Shares | A revoked share is never active, at any time; time only moves a share toward expired; active means unrevoked and unexpired and nothing else does. |
| Small cells | No cell under the floor is shown and nothing shown is altered; a group is never left with exactly one withheld cell. |
| Group comparison | A rate is shown only when the group, those who acted and those who did not all clear the floor; a gap is computed only when every group is shown; order does not matter. |
| Tenant contract | It never allows what the flag evaluator refuses; no contract is invisible; it cannot open a route the floor keeps shut; outside its term everything is refused; tightening only removes access; allowed means the governing clause was met; drift agrees with the decision. |
| Evaluation history | An expired, forgotten or capped-out record is never shown; only the listed fields are stored; any requested policy is short, whole and under its ceiling; lengthening retention cannot bring back what a purge deleted. |

## A property that has never failed is not known to be one

Every property here was run against the defect it exists to catch, in the source
and not only in a copy: a planted change, a red test, then the change removed. That
found two holes in this harness's own first draft, both recorded in D-156. The scope
expiry property stayed green with the check removed, because the generator almost
never reached that step, so the draws are now biased toward contexts that do and a
control fails if the step is never refused. The eligibility check stayed green too,
because a property about denial cannot see a check that is missing, so there is a
second property that an allowed answer meant every stated gate was met.

## Not covered

The database's row-level security is checked by the `.check.sql` suites, not by this.
Nothing here models concurrency; the load and soak harness does. Nothing here checks
the client and the server agree. Neither the flag evaluator nor the contract has a
server-side twin under test.
