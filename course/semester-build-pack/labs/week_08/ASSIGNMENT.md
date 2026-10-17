# Week 8: Accessible interfaces

Outcome: Model accessible errors and explicit interface states.

## Required implementation
Return {field, message, described_by}; described_by is field + -error.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Build keyboard-operable task forms with labels, error associations, focus handling and explicit loading/empty/error/offline states. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 8 --submission labs/week_08/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
UI demo, manual accessibility checklist and state matrix.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.
