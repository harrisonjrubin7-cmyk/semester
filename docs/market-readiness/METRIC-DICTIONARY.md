# Metric dictionary

| Metric | Canonical definition | Exclusions | Status |
| --- | --- | --- | --- |
| eligible cohort | people validly included in the signed cohort at the measurement cutoff | staff, tests, withdrawn/ineligible people | customer-approved source required |
| activated student | eligible student who completes consent/notice and minimum required setup | invitation/open/login only | proposed |
| first win | activated student who creates a usable prioritized Today/This Week action after minimum setup | demo/sample data; staff-assisted test account | proposed; production validation required |
| meaningful engagement | approved workflow completion such as planning, task prioritization, checklist progress, or support discovery | passive page view or raw login | proposed |
| weekly engaged student | activated student with at least one meaningful engagement in the reporting week | support/staff/test activity | proposed |
| time to first value | elapsed time from consented start to first win | time before invitation delivery; paused/invalid attempts | proposed |
| workflow success rate | successful completed attempts / valid started attempts for the defined core workflow | automated probes and tests | telemetry design requires acceptance |
| safe recovery rate | failed attempts reaching an actionable, non-destructive recovery outcome / valid failed attempts | silent errors and abandonment | telemetry design requires acceptance |
| support burden | count/severity, response time during published hours, resolution age, and repeat-contact rate | automated spam/tests | support system required |
| conversion | sponsor-approved move to an executable annual scope after final review | verbal interest or proposal alone | commercial system required |

Every reported metric must include period, denominator, sample size, privacy threshold, source, freshness, missing-data treatment, version, owner, and caveat. Do not compare cohorts or imply causality without an approved design.
