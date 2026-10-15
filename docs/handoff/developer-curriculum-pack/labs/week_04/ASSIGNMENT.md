# Week 4: Pagination and API design

Outcome: Design bounded collection responses.

## Required implementation
Given items, offset and limit, return items[offset:offset+limit]; reject negative offset or limit outside 1..100 with ValueError.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Implement list/create task operations against synthetic storage with cursor pagination, structured errors and bounded inputs. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 4 --submission labs/week_04/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Contract examples, handler tests and API walkthrough.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.

**Exact rule (tests check each part):** Given items, offset and limit, return items[offset:offset+limit]; raise ValueError if offset < 0 or limit is outside 1..100. An offset past the end returns [].
