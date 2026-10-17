# Week 6: Tenant isolation

Outcome: Deny cross-tenant access even with a valid scope.

## Required implementation
Require matching nonempty principal/resource tenant, active grant and tasks:read.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Run the same identifiers in two tenants. Test database, API, cache and search boundaries; for a mock layer clearly state what is not tested. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 6 --submission labs/week_06/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Isolation matrix with actual results and limitations.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.
