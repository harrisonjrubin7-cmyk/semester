# Integration Data Minimization Matrix

| Purpose | Minimum fields | Exclude by default |
| --- | --- | --- |
| Course launch | subject, course/context, role | grades, unrelated courses |
| Roster | stable ID, section, role, status | demographics, notes |
| Calendar | title, time, course, source link | grades, private notes |
| Grade read | student, item, released score/status | drafts, other students |
| Advisor handoff | student-selected summary/contact | full activity history |
| Registration prep | catalog/rules/status needed for check | aid, health, discipline |
| Support referral | contact, selected need, consent | course content, AI logs |

---

Evidence baseline: `origin/main` at `8ccf55af`, assessed 2026-10-03. “Implemented” means repository evidence, not institutional approval or observed production operation.
