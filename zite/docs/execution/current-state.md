# Current state (22 Oct 2026)

## Apps (workspace "Education OS")
| App | Access | Purpose | Published |
|---|---|---|---|
| Semester (`apps/semester`) | external | Education product and Institution Console | No (never published) |
| Semester Applicants | external | Applicant portal | No |
| Semester Family | external | Guardian view of what a student shares | No |
| Semester Employers | external | Employer postings and applicants | No |
| Semester Site (`apps/semester-site`) | external | Public site: pilot, pricing, trust, contact | No |
| Semester Company OS (`apps/semester-company`) | internal (org members only) | Restricted company operations (in progress) | No |
| implement-and-build-the-complete | — | Empty scaffold created by Zite's own agent at 20:17 UTC from the founder's prompt. Left untouched for the founder to keep or delete. | No |

## Data (tables)
The 20 original tables (Institutions, Memberships, Requirements, Courses, Sections, Enrollments, Tasks, Submissions, Appointments, Cases, Resources, Groups, Events, Opportunities, Achievements, Messages, Consents, Integrations, Feature Status, Audit Events, Applications, Attendance), plus these added today:
- **Regrade Requests**: regrade workflow.
- **Inbound Requests**: public-site pilot, pricing, security, accessibility and contact requests.
- **Source Register**: source documents with originals attached.
- **Company Risks**: Book 1 risk register plus platform risks.
- **Simulator Scenarios**: saved planning scenarios.
- Enrollments.Status gained **Requested**.

All demo data belongs to one Sample institution (Northgate University) and one user account.

## Changes made today (commits on main)
1. e9c1fd4: tenant isolation fixes across seven areas; course AI rules enforced.
2. 60d8549: regrades.
3. 12ef715: registration readiness and submission; no student-record AI egress.
4. 5d7dd81: advisor sharing.
5. 6b97f5a: public site.
6. 8545a34: foundation slice (audited completion, notification).
7. This commit: context, execution docs, readiness matrix.

## Tests
`sh apps/semester/tests/run.sh`: aiGate 11, readiness 9, regrade 12, shares 10. `sh apps/semester-company-os/tests/run.sh`: costModel 12, billingSim 11, systemMap 6, scenario 5. All 76 pass; mutation checks turn the guarded tests red. Runtime probes are recorded in commit messages. No CI.
