# Week 5: Authentication versus authorization

Outcome: Require active grants and operation scopes.

## Required implementation
Return True only for active grants containing tasks:read.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Add mock sign-in and scoped request contexts. Keep authentication separate from operation authorization; deny missing or expired grants. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 5 --submission labs/week_05/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Identity-flow diagram and denial matrix.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.

**Exact rule (tests check each part):** Return True only when active is exactly True and scopes contains the exact string tasks:read.
