# Week 13: Security threat modeling

Outcome: Reject unsafe webhook destinations in a constrained exercise.

## Required implementation
For literal-IP HTTPS URLs only, return True if IP is globally routable, no credentials and port absent or 443. DNS hostnames are intentionally rejected.

## Assignment
1. Implement starter.py using synthetic data only.
2. Add at least three boundary or denial tests beyond the visible cases.
3. Write DESIGN.md explaining trust boundaries and limitations.
4. Complete the connected capstone increment described below.
5. Submit code, test evidence, DESIGN.md and a 150-250 word reflection.

## Capstone increment
Threat-model object authorization and webhook egress. Explain DNS rebinding, redirects and the limits of the literal-IP teaching exercise. The small Python exercise is a testable concept drill, not the entire application requirement.

## Verification
Run: python grader.py --lab 13 --submission labs/week_13/starter.py --report result.json

## Rubric
Correctness 30; tests 25; security/privacy 20; maintainability 15; documentation/reflection 10. Automated tests supply evidence for correctness only; instructor assesses remaining dimensions.

## Weekly evidence
Threat model, attack tests and unresolved risk register.

## Acceptance
All visible cases pass, three additional cases are justified, no real records or secrets, and architecture claims match actual implementation.

## Extension
Implement the same contract in strict TypeScript and integrate it into the capstone interface.

**Exact rule (tests check each part):** For HTTPS URLs with a literal IP host only: return True if the IP is globally routable (not private, loopback, link-local or reserved), there are no credentials, and the port is absent or 443. DNS hostnames are rejected.
