# Competitive completion audit

_Semester strategy · 2026-10-05 · Source: uploads/anything else to finish semester and make it the m.pdf. Design-stage evidence only; scores rise with repo, test and release evidence._

> Semester wins when students prefer it daily, institutions trust it operationally, and partners prefer building on it.

The decisive advantage is not more features. It is being the easiest to adopt, safest to operate, clearest to use, fastest to implement and most credible to buy.

## Core loop

Identity → Path → Action → Learning → Support → Evidence → Progress → Opportunity. Every feature must strengthen at least one node.

## Coherence test (release gate for any new feature)

- Who uses it?
- What problem does it solve?
- What source is authoritative?
- What data does it need?
- What action does it create or complete?
- What policy governs it?
- How does it connect to Path, Action Center, Support and Career?
- What happens when it fails?
- What happens when data is stale?
- How is it supported?
- How is it measured?
- How is it rolled back?
If the answers are unclear, the feature is not ready.

## Audit by area

| Area | Current evidence | Benchmark (5) | Customer impact | Priority | Required capability | Test / metric |
| --- | --- | --- | --- | --- | --- | --- |
| Daily student experience | ui_kits/student, every-screen, templates/platform-shell | Beats email+LMS+calendar+portal+AI chat combined | Daily return, action completion | P0 | Today, Action Center, return loop | Usability test 5 students; first action ≥70% |
| Product coherence | One design system, 673 screens, one shell | One intuitive system | Fewer dead ends | P0 | Coherence test on every feature (below) | Release checklist enforces it |
| Mobile/native quality | ui_kits/mobile (tab bar) | Native-feeling, reliable | Students judge on phone | P0 | Fast shell, offline-safe workspace, deep links, quick capture, low-bandwidth | Lighthouse mobile, offline sync tests |
| Course Studio and learning | Partly designed (staff kit) | Connected learning environment | Faculty adoption | P1 | Course Studio, LTI to LMS | Faculty workflow e2e |
| Academic records / registrar | Registrar desk designed; SIS stays official | Deterministic, auditable workflows | Correctness | P0 | Policy engine for prerequisites, holds, credit limits, windows | Rule tests per policy |
| Governed AI | Gateway logic + AIResponse | Policy-bound, source-aware | Safety + usefulness | P0 | AI trust UI: context, sources, policy, model, uncertainty, action, human | Red-team suite |
| Institutional trust | Trust Center page, policies, contracts | Evidence-backed procurement | Shorter procurement | P0 | Procurement room, HECVAT Lite + Full, questionnaire library, AI provider registry | Reviewer can answer 10 questions unaided |
| Security/privacy/accessibility | Policies, test plans | Continuous controls | Risk | P0 | Evidence register, VDP, ACR | Controls with evidence |
| Integration factory | Designed workflow | Repeatable interoperability | Implementation speed | P0 | LTI wizard, OneRoster import, SSO/SCIM guide, test harness | Connector certification |
| Migration factory | Designed workflow + cutover | Reusable migration product | Replacement confidence | P1 | Mapping studio, reconciliation, rollback automation | 0 unexplained mismatches |
| Reliability/SLO/incidents | Handbook + runbooks | SLO-driven ops | Uptime | P0 | Monitoring, status page, alerts | Restore drill time |
| Implementation and CS | Runbook, support plan | Repeatable implementation | Weeks not months | P0 | Implementation factory: questionnaire, tenant templates, role bundles, launch kit | Days signature-to-launch |
| GTM and pilot conversion | GTM plan, price book | Predictable conversion | Revenue | P1 | Pipeline, MAP, results report | Pilot-to-annual |
| Finance and unit economics | Finance model | Predictable economics | Survival | P1 | 36-month model, AI cost per workflow | Gross margin |
| Developer platform/marketplace | Designed workflow | Documented APIs, partners | Ecosystem | P3 | API standard, sandbox, certification | Certified apps |
| Global readiness | US assumptions | Configurable international | Expansion | P3 | i18n, calendars, grading, residency | Strings externalized |
| Research and outcome proof | Results template | Verified evidence | Credibility | P1 | Measurement protocol, evidence register | Measures met |
| Brand and category authority | Brand system, site | Recognized infrastructure brand | Trust | P2 | Case study, research, transparent status | References |
| Company operations | docs/business, /ops | Systems not heroics | Repeatability | P1 | Operating cadence, decision log | Cadence held |
| Organizational maturity | Solo founder | Owners, cadence, resilience | Continuity | P1 | Key-person plan, revenue-triggered hires | Owners per function |

## Top 25 gaps

1. Insurance not bound
2. DPA not signed
3. HECVAT not submitted
4. No ACR
5. No production code for pilot paths
6. RLS untested
7. No monitoring
8. SIS connector not built
9. No reconciliation run
10. AI red-team not run
11. No mobile build
12. No implementation factory assets
13. No procurement room
14. No status page
15. No policy engine
16. No usability test
17. Measures not signed
18. No case study
19. No 36-month model
20. Founder single point of failure
21. No KB/help center
22. No event taxonomy
23. No API standard implemented
24. US-only data model
25. No decision log

## What not to do

- Build everything as a separate module
- Make every dashboard dense
- Hide complex policy behind AI
- Collect data just in case
- Make high-impact recommendations opaque
- Overpromise replacement before migration proof
- Make configuration need custom engineering
- Let tenants fork the product
- Use student data for advertising or surveillance
- Let compliance become static PDFs
- Ship without support, monitoring and rollback
- Depend on one AI provider
- Build a closed ecosystem without export
- Scale paid acquisition before pilot conversion works
- Pursue every segment at once
