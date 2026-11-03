# Week 12: Typed SDK behavior

Outcome: Model bounded retry decisions.

## Required implementation
Return True for 429 or 503 only when attempt < max_attempts and method GET or idempotency_key is nonempty.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Implement a strict TypeScript client or equivalent typed wrapper with runtime validation, cancellation and bounded safe retries. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 12 --submission labs/week_12/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Client code, type-misuse tests and compatibility table.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.
