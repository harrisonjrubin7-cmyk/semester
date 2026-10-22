# Data classification

_Semester design, intelligence, workflow and data system · 2026-10-05 · Source: uploads/expand further on brand identy algorthims workflow.pdf, reconciled with this design system (readme.md, tokens/, components/). Where they differ, this design system wins and the difference is listed._

> Semester should make an institutionally complex world feel personally clear.

| Tier | Example | Handling |
| --- | --- | --- |
| T0 | Public marketing content | Public, cacheable |
| T1 | Internal operational metadata | Authorized staff |
| T2 | Student-owned workspace data | Private to the student by default |
| T3 | Institutional academic/personal data | Tenant-scoped, policy-controlled (FERPA) |
| T4 | Sensitive support, accessibility, financial data | Restricted, purpose-limited, audit-heavy |
| T5 | Credentials, secrets, auth material | Server-only, never in the browser |
| T6 | Highly restricted legal/security evidence | Named reviewers only |

AI may receive T0–T2 under policy; never T3–T6 student records.
