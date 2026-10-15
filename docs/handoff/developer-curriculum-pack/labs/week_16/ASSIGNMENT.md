# Week 16: Capstone activation and defense

Outcome: Separate evidence from human production authority.

## Required implementation
Require certified, institution_approved, reconciled, rollback_ready and support_ready all exactly True.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Demonstrate the full extension, revoke access and show recovery/offboarding. Defend three architecture decisions and publish only chosen synthetic portfolio evidence. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 16 --submission labs/week_16/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Capstone demo, defense notes, portfolio consent and final evidence pack.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.

**Exact rule (tests check each part):** Require certified, institution_approved, reconciled, rollback_ready and support_ready all present and exactly True.
