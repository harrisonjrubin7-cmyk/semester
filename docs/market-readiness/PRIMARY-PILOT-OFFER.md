# Semester Student Success and Registration Readiness Pilot

## Recommendation

Sell a narrow registration-readiness outcome, not a university-system replacement. Semester helps a defined cohort reach a registration or term-start milestone with an organized schedule, visible workload, completed next actions, clear support paths, and measurable confidence. Institutions receive aggregate, privacy-thresholded evidence—not student surveillance or an automated risk score.

## Ranked configurations

| Rank | Configuration | Buyer / economic buyer | Champion / daily operator / user | Required data | Optional data | Risk | Implementation | Dependencies | Success measures | Disqualifiers | Expansion |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Registration readiness** | Student Success, Enrollment, Advising / VP Student Success or Enrollment | advising/program lead / coordinator / student | cohort eligibility, academic dates, public or approved program guidance; manual student inputs | read-only calendar, SSO, approved holds/deadline feed | medium | 30–60 days | manual setup, Today/This Week, checklist, aggregate reporting, support | activation, readiness checklist completion, confidence, avoidable-question rate, on-time registration proxy | requires writes to SIS; individual risk scoring; no champion; cohort <10 or >200 | first-term success, advising, read-only integrations |
| 2 | **First-term success** | Student Success / VP Student Affairs or Provost | first-year/transfer lead / success coach / student | term dates, support directory, course/task setup | read-only LMS/calendar | medium | 45–60 days | onboarding, planning loop, notifications, support | week-1 activation, week-4 retention, weekly planning, clarity, support discovery | no baseline; no weekly operator; high-risk data required | program/college rollout |
| 3 | **Advising and degree progress** | Advising or college / Provost or dean | advising director / advisor / student | program requirements and student-entered plan | approved read-only degree audit | medium-high | 45–60 days | plan clarity, source/freshness, advisor agenda | preparation completion, meeting efficiency, next-step clarity | authoritative audit/writeback expected; no registrar approval | department-wide planning |
| 4 | **Productivity/workload** | learning community, honors, TRIO-like program / program dean | program director / coordinator / student | none beyond student-entered courses/tasks | calendar subscription | low | 14–30 days | manual onboarding, Today/This Week, reminders | activation, week-4 retention, planning completion, confidence | mandatory sensitive disclosure; surveillance expectation | registration or first-term pilot |

## Primary scope

- 50–200 students; one cohort; one academic milestone.
- Manual/read-only data first. No official record writes.
- Student-owned course, calendar, task, and plan setup.
- Today/This Week, workload visibility, registration checklist, support discovery, and carefully controlled reminders.
- Aggregate reporting only when a cell contains at least 10 students.
- Weekly operating review, midpoint checkpoint, final decision, and clean offboarding.

## Explicit exclusions

No admissions, aid, discipline, disability, health, counseling, immigration, conduct, or individual “risk” decisions; no authoritative academic advising; no automated registration; no grade prediction claim; no system-of-record replacement; no unapproved SIS/LMS writeback; no sale or behavioral advertising based on education records.

## Fallback low-integration offer

The **Student Productivity and Academic Workload Pilot** uses manual setup, optional personal calendar subscription, synthetic admin views, and student-reported outcomes. It can demonstrate activation and planning value while institutional integration remains blocked.

## Pilot conversion thesis

Conversion is earned when the agreed cohort reaches its activation/readiness targets without breaching privacy, support, accessibility, or reliability guardrails; the sponsor signs an outcome decision; and an annual scope can be supported with the evidence actually collected. The next expansion should be adjacent—another cohort, program, or approved read-only source—not a leap to whole-campus replacement.

## Reconciliation (2026-10-04)

The 14–60 day figures above are the implementation window of each offer. Every pilot, whichever offer it uses, runs exactly 26 weeks (D-134, `PILOT_WEEKS`), and the deal desk's 6-month maximum is only the outer limit. The 50–200 cohort is the target; the hard bounds are 10 to 200 (`docs/PAID-PILOT-FRAMEWORK.md`). Institutional pilots are not offered for activation until the executive go decision allows it; until then the offer is design-partner discovery and scoping.
