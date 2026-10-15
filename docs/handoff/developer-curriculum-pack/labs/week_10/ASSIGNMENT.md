# Week 10: Events and deduplication

Outcome: Suppress duplicates while preserving first-seen order.

## Required implementation
Given ids list return distinct ids in first-seen order.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Add an outbox and event consumer. Test duplicate and stale events, bounded retries and a dead-letter recovery path. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 10 --submission labs/week_10/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Event contract, consumer tests and reconciliation instructions.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.

**Exact rule (tests check each part):** Given ids, return the distinct ids in first-seen order.
