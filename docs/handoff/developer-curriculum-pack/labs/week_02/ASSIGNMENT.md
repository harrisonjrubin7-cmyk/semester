# Week 2: Git and engineering evidence

Outcome: Produce a reviewable change with reproducible evidence.

## Required implementation
Return True only when title, test_evidence and reviewer are nonempty strings.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Implement a small capstone change on a feature branch. Request peer review, respond to comments and record reproducible test evidence. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 2 --submission labs/week_02/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
PR export, review notes and reproducibility checklist.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.

**Exact rule (tests check each part):** Return True only when title, test_evidence and reviewer are all present and nonempty strings.
