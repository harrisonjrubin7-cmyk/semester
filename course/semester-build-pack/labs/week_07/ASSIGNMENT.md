# Week 7: Transactions and audit

Outcome: Validate mutation evidence before commit.

## Required implementation
Return True only if actor, tenant, action, target and request_id are nonempty strings.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Add migration constraints, transactional audit metadata and a rollback plan. Demonstrate that failed audit writes prevent protected mutations. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 7 --submission labs/week_07/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Migration, rollback procedure and failure test.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.
