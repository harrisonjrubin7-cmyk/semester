# Learning and University Systems Audit Package

This directory is the decision layer requested by the 31-page master brief. It does not duplicate the repository’s existing detailed registers; it connects them into one evidence-gated product, learning, LMS, student-success, integration, and operating model.

## Method

- Code, tests, migrations, configuration, and runbooks are evidence.
- A screen or schema alone is not a production capability.
- Status is GREEN, YELLOW, RED, or GRAY.
- Delivery mode is Native, Integrated, Official handoff, or Out of scope/partner.
- Institution readiness requires external approvals, configured providers, UAT, support ownership, and observed operations.
- Claims from the supplied PDF were treated as requirements, never as proof.

## Verification snapshot

- Production build: pass.
- Full repository suite on baseline `8ccf55af`: the aggregate run completed 19,729 tests and timed out on eight tests across five resource-sensitive files; each failed file then passed in isolation (52/52 tests). This is strong local regression evidence, but not a single clean aggregate run.
- Focused learning/LMS suite: 108/108 pass.
- Focused AI/source-governance suite: 41 files passed; 628 tests passed and 48 live-provider tests skipped.
- Performance budgets: pass.
- Institutional TypeScript check: pass.
- Lint: pass; 22 warnings remain under the repository ceiling of 25.
- Governance/source register refresh: pass; 97 rollout evidence sources indexed and 791 tests across 65 register suites passed with no generated-file drift.
- Browser accessibility smoke: pass across seven critical journeys at desktop and 320px reflow; skip focus, landmarks, titles, accessible names, and ARIA references verified.
- Golden-path smoke: pass across all 13 steps at phone and desktop sizes, including first run, syllabus import, Today, planning, degree path, sourced deadline details, help routing, completion, same-device resume, and backup restore into a fresh browser context.
- Golden-path limits: the run used the repository's model stub, human-help sending was disabled in this build, and account-synced cross-device resume remains a separate integration claim.
- AI/source-label disposition: policy, source-locker, disclosure, and grading-boundary regressions pass. Grounded Ask answers expose source title, locator, and excerpt; general-knowledge answers explicitly say “No source.” Because not every answer has a citable source, this gate remains open for consequential-use verification.
- HawkScan DAST: not run; the required `hawk` CLI is not installed in this environment.

The final decision is in [LEARNING-AND-UNIVERSITY-SYSTEMS-GO-NO-GO.md](LEARNING-AND-UNIVERSITY-SYSTEMS-GO-NO-GO.md).
