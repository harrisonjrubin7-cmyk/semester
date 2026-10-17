# Week 11: Diagnostics and recovery

Outcome: Remove sensitive fields from telemetry.

## Required implementation
Return record excluding token, password, student_name and submission_body keys.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Add redacted request tracing and dependency outage simulation. Recover without exposing private payloads or silently dropping writes. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 11 --submission labs/week_11/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Failure timeline, telemetry sample and recovery evidence.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.
