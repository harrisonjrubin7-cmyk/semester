# Week 3: Contracts and validation

Outcome: Validate network-shaped input without coercion.

## Required implementation
Return True when id/title are nonempty strings and status is open or completed.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Define Task, Grant, Event and Error contracts. Reject malformed values at the boundary and document nullable versus optional fields. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 3 --submission labs/week_03/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Schemas, six invalid-input tests and field dictionary.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.

**Exact rule (tests check each part):** Return True when id and title are present nonempty strings and status is exactly open or completed.
