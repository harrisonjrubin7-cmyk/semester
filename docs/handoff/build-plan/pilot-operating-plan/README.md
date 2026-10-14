# Pilot Operating Plan — PILOT-READINESS-001 (from "continue (16).pdf")

Takes registration readiness from release candidate (SPRINT-PILOT-001) to a controlled activation at Vanderbilt.

| File | What |
|---|---|
| docs/pilot/PILOT-READINESS-001.yaml | objective, promises, non-promises, six decision questions |
| evidence/pilot/scope-record.yaml | the one record both sides sign before configuration (tenant, term, cohort, roles, sources, frozen outcome meanings) — signatures pending |
| docs/pilot/launch-cadence.yaml | five stages ending on evidence, not dates; stage 1 open; first two weeks |
| docs/pilot/roles-and-escalation.yaml | decision owners with names where known; **one severity scale** (P0–P2) mapped onto the S1–S4 and Sev 1–4 used elsewhere |
| docs/pilot/journeys.yaml | student journey 1–6 with next step per outcome, receipt contents, core copy; staff queue item, allowed and forbidden actions |
| evidence/releases/REL-READINESS-001.yaml | 15 evidence items, invalidation triggers, **four different approvers**: Harrison (product), security advisor (engineering/security), contractor (operations), Vanderbilt pilot owner |
| docs/pilot/hypercare-and-change.yaml | daily review agenda, change freeze, measurement definitions, end-of-pilot options |
| scripts/daily-pilot-health.mjs.txt | builds the daily record and derives activation status from rules |

Run here: the health script on five days — normal → active; an open P0 → safe-off; degraded source connector → limited; 15 of 60 requests stale → limited; tiny volume with stale results → active (below the 20-request floor for a share rule). Thresholds are proposals to agree with Vanderbilt.

Correction: the release needs four distinct approvers and Harrison holds product, engineering and operations roles today — so operations is signed by the contractor and engineering/security by the security advisor.
