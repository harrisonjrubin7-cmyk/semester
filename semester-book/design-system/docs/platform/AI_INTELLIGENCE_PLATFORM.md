# Governed AI intelligence layer

_Semester platform maturity program · 2026-10-05 · Source: uploads/what else is needed to become the apple google and.pdf. Status is design-stage: nothing is "done" until repo code, tests and release evidence exist._

**Principle:** Semester must become the system people prefer to use every day, the system institutions trust to operate, and the system partners prefer to build on.

## Standard

- Generic AI is prompt → answer. Semester AI is person + role + tenant + course + policy + source authority + consent → allowed model and tools → contextual answer → citations and limits → safe action or hand-off → audit and improvement.
- Model routing, provider policy, course policy, institution policy, student preferences, data classification, source retrieval, citations, tool permissions, cost controls.
- Evaluation harness, red-team tests, human escalation, feedback and correction, AI audit log, AI incident response.
- Aligned with the NIST AI RMF Generative AI Profile (NIST AI 600-1): manage trustworthiness, privacy and legal risk across design, deployment, use and evaluation.
- AI can explain an official rule. It cannot silently become the official rule.

## Capability record

| Field | Value |
| --- | --- |
| Current evidence | `ui_kits/architecture/ (AI gateway)`, `handoff/semester-core/aigateway.ts.txt`, `guidelines/02-ai-governance.md`, `components/trust/AIResponse.jsx` |
| Implementation state | Designed: 17-step governed request, AIResponse component, gateway logic with tests. Red-team suite not run. |
| Product owner | Product |
| Technical owner | Engineering (AI gateway) |
| Risk owner | Security |
| Success metrics | Student-record leaks to providers = 0; Answers with citations; Human escalation offered when policy requires; Cost per workflow |
| Launch gate | Red-team suite passes (pilot launch gate) |
| Next action | Write and run the red-team prompt suite against the staging gateway |
| Security / privacy / accessibility | RLS + tenant_id on every row; no student records to AI; WCAG 2.2 AA |
| Replacement authority gate | Institution approval with reconciliation evidence before Semester becomes authoritative for any domain |

## Execute

See `handoff/execute/` streams and `13-platform-maturity.md`.
