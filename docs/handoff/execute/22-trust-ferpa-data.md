# Stream 22: FERPA, data flows, vendor controls and AI governance

Branch `semester/trust-ferpa-data` from `origin/main`. Depends on streams 01 (platform core) and 02 (identity). Read `handoff/BUILD.md` "Read this first" before starting: **the live repo wins every conflict**; extend its authorization core, schema and design system instead of creating parallel ones.

## Inputs
- Prototype files (acceptance reference, not code to ship): `ui_kits/semester-app/Ferpa.jsx`, `ui_kits/semester-app/DataZones.jsx`, `ui_kits/semester-app/Revocation.jsx`, `ui_kits/semester-app/CloudAccounts.jsx`, `ui_kits/semester-app/DpaRules.jsx`, `ui_kits/semester-app/TestsContract.jsx`, `ui_kits/semester-app/GovMonitor.jsx`, `ui_kits/semester-app/Authority.jsx`, `ui_kits/semester-app/JwtInspector.jsx`
- Source specifications (copy to `docs/specifications/source/`): `FERPA audit checklist…apps -.pdf + react-lib-scroll.pdf`; `ferpa-checklist-2.pdf`; `ferpa-checklist-1.pdf + Build an interactive React student app prototype a.pdf`; `Redis Feed Pipeline.pdf + FERPA audit checklist…_ s.pdf`; `Build a React state-management….pdf + SIS-to-advising architecture audit….pdf`
- Screen list with components: `handoff/prototype/SCREEN-INVENTORY.md` (filter Stream = 22)
- Design rules and tokens: `readme.md`, `SKILL.md`, `styles.css`

## Screens to build (12)

| Route in prototype | Screen | Prototype component |
| --- | --- | --- |
| `#/institution/authority` | Domain authority | AuthorityMap (Authority.jsx) |
| `#/advisor/rules` | Rule evaluator | DpxEvaluator (DpaRules.jsx) |
| `#/trust/matrix` | Access matrix | FerpaMatrix (Ferpa.jsx) |
| `#/trust/monitor` | Governance monitor | GovMonitor (GovMonitor.jsx) |
| `#/trust/dpa` | Vendor DPA draft | DpxDpa (DpaRules.jsx) |
| `#/trust/dataflow` | Data flow and Schedule A | ZnxFlow (DataZones.jsx) |
| `#/trust/cloud` | Cloud controls | ClxCloud (CloudAccounts.jsx) |
| `#/trust/revocation` | DC-02 revocation lab | RvxLab (Revocation.jsx) |
| `#/trust/contract` | Contract worksheet | TrnContract (TestsContract.jsx) |
| `#/operations/jwt` | JWT inspector | JwtAndAgs (JwtInspector.jsx) |
| `#/social/accounts` | Accounts (mock API) | ClxAccounts (CloudAccounts.jsx) |
| `#/social/tests` | Test runner | TrnRunner (TestsContract.jsx) |

## Behaviors to reproduce
Each bullet is the as-built prototype behavior. Implement it against real data and services; where the prototype simulates (timers, toggles, fake servers), build the real mechanism and keep the toggle as a test fixture.

- **Tests + contract (6 Oct):** TestsContract.jsx (TRN*): #/social/tests (12 live in-browser tests: persistence, malformed JSON, shape validation, reply-parent post match, comment cycles, mock-API session, handle + media URL validation, diversity cap, block filter, ANY_OF/ALL_OF; pre-release gaps + deploy checklist), #/trust/contract (9-item vendor contract worksheet with status, deletion-clause analyzer for 7 required definitions, ownership clause). From Build a React state-management….pdf + SIS-to-advising architecture audit….pdf.
- **DC-02 lab (6 Oct):** Revocation.jsx (RVX*): #/trust/revocation — toggle assignment, per-device sessions, refresh family, JWT deny-list, user disable, relationship-service outage; fire requests (devices, old JWT, refresh, replicas r2/r3 with 0.5/2/4 s propagation, export) and see 200/401/403/503 with reasons; T0 timer vs 5 s target; pass criteria. From ferpa-checklist-2.pdf.
- **Cloud + accounts (6 Oct):** CloudAccounts.jsx (CLX*): #/trust/cloud (DC-01–12 direct-control matrix with status, AWS/GCP control mapping toggle with required app control, 7 configuration traps), #/social/accounts (mock account API in localStorage: register with validation/409, login/logout, publish video with URL validation, portfolio projects, follow/like across accounts, API log, reset). The PDF’s ZIP/SQLite backend wasn’t provided; this simulates it. From ferpa-checklist-1.pdf + Build an interactive React student app prototype a.pdf.
- **Data zones (6 Oct):** DataZones.jsx (ZNX*): #/trust/dataflow — 5-zone SIS→user flow with per-boundary controls + fail-closed simulation, optional AI explanation path with deterministic fallback, separate write path; encryption zones; PII storage by store; Schedule A (A.1 function, 11 authorized services with boundaries, A.3 optional services off until amendment). Scroll feed: 70% threshold, manual pause preserved while active, missing-file error slide. From FERPA audit checklist…apps -.pdf + react-lib-scroll.pdf.
- **DPA + rules + Redis fallback (6 Oct):** DpaRules.jsx (DPX*): #/trust/dpa (10-section vendor addendum with editable parties and negotiated day/hour terms, schedules A–E), #/advisor/rules (ALL_OF/ANY_OF evaluator with 5 atomic states, blockers/conditional/permission/unknown kept separate, edge cases, 13 required tests). Feed delivery gained a Fallback tab (healthy/degraded/unavailable + stale-while-revalidate table). From Redis Feed Pipeline.pdf + FERPA audit checklist…_ s.pdf.
- **Campus portals SQL and more:** 010_campus_portals.sql; Authority.jsx (#/institution/authority); Deep Linking and signature-test notes in LTI-ADAPTERS.md; tests/ holds the user's jwt suite and results (Node suite not run).
- **FERPA and ledgers:** 011 + 012 + 013_audit_logging.sql; housing_dining_erd.mmd; JwtInspector.jsx (#/operations/jwt); Ferpa.jsx (#/trust/matrix).

## Tasks
1. Map each screen to the repo’s routing and layout; reuse existing components from the design system bundle before adding new ones.
2. Define or extend the data model and API for every state the screens show. Server-authoritative for permissions, grades, money and enrollment.
3. Enforce authorization on the server for every read and write (deny by default). Add negative tests.
4. Implement empty, loading, error, offline and permission-denied states shown in the prototype.
5. Write unit, integration and accessibility tests for each behavior bullet. Use synthetic data only.
6. Keep copy and labels from the prototype unless the repo’s content guide says otherwise.

## Exit gates
- [ ] Every screen above reachable from navigation for the right roles and absent for others
- [ ] Every behavior bullet covered by a passing test
- [ ] Typecheck, lint, unit, integration and a11y checks pass (`handoff/verify.sh`)
- [ ] No production data, secrets or remote migrations touched
- [ ] Report written to `docs/execute/22-trust-ferpa-data-report.md` with evidence; PR opened; STOP for human review
