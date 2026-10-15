# Week 14: Release and certification evidence

Outcome: Check release-linked evidence completeness.

## Required implementation
Require artifact_digest, contract_version, fixture_version plus passing contract, isolation, revocation, accessibility and recovery evidence.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Freeze a release artifact and assemble contract, isolation, revocation, accessibility and recovery evidence tied to its digest. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 14 --submission labs/week_14/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Evidence manifest, dependency inventory and mock certification submission.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.

**Exact rule (tests check each part):** Require nonempty artifact_digest, contract_version and fixture_version, and tests.contract, isolation, revocation, accessibility and recovery each exactly True.
