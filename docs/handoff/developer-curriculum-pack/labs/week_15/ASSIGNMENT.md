# Week 15: Pilot reconciliation

Outcome: Identify missing and unexpected canonical identifiers.

## Required implementation
Given expected and observed ids return sorted missing and unexpected lists.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Run a synthetic pilot, inject drift, reconcile identifiers and rehearse rollback. Record support ownership and unresolved defects. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 15 --submission labs/week_15/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Pilot report, reconciliation output and rollback rehearsal.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.

**Exact rule (tests check each part):** Given expected and observed ids, return {"missing": sorted(expected - observed), "unexpected": sorted(observed - expected)}.
