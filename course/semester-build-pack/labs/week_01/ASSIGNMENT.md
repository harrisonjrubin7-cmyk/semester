# Week 1: System boundaries

Outcome: Map the shared shell, domain services and private/official data.

## Required implementation
Return private for draft, official for grade, and synthetic for fixture.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Draw a context diagram with learner, instructor, publisher and institution boundaries. Add an ADR separating private drafts from official submissions. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 1 --submission labs/week_01/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Diagram, ADR-001 and synthetic fixture inventory.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.
