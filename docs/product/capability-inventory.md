# Phase A capability inventory

Assessed 2026-10-03 at `8ccf55af`. This inventory covers all 60 capabilities in the existing typed governance register. Status is operational exposure, not repository maturity. `early_access` means usable student-owned functionality that still lacks one or more operational tests; it does not mean GA.

## Legend

- Roles: S student, F faculty, A advisor, G guardian/family, I institution operator, P partner, O Semester operator.
- Sources: ST student/Semester-owned, LS local/browser state, SIS/LMS authoritative institution source, IP external identity/provider, SYN synthetic/sandbox, PUB public/institution content.
- Classification: C0 public, C1 account/preferences, C2 private student content, C3 education record/restricted, C4 high-risk financial/health/conduct/official-write.
- Platform: W web, P PWA/mobile web, N native required for the target secure-offline contract.
- Missing-test codes: O eight-test operational record; U representative UAT/accessibility; R reliability/support/rollback; T tenant approval/data map; V live provider/source; M measurement/outcomes; C commercial/legal; X cross-tenant/permission negative evidence; N native encrypted offline; D delivery/receipt/reconciliation.

Owner values are accountable seat placeholders, not proof that a person is assigned.

| ID | Capability | Product plane | Roles | Status | Current evidence | Source | Class | Platform | Owner placeholder | Missing operational tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CAP-001 | Today | Student OS | S | early_access | Typed registry, route, tests | ST/LS | C2 | W/P | Product + Eng + Support | O,U,R,M |
| CAP-002 | Reports | Student OS | S | early_access | Local summaries/tests | ST/LS | C2 | W/P | Product + Data | O,U,M |
| CAP-003 | Calendar | Student OS | S | early_access | Local/feed UI and source states | ST/IP | C2/C3 | W/P | Product + Integrations | O,U,R,V,D |
| CAP-004 | Exam Runway | Student OS | S | early_access | Planning implementation/tests | ST/LS | C2 | W/P | Learning product | O,U,M |
| CAP-005 | The Week Ahead | Student OS | S | early_access | Planning implementation/tests | ST/LS | C2 | W/P | Learning product | O,U,M |
| CAP-006 | When You Are Behind | Student OS/support | S | early_access | Recovery planning/tests | ST/LS | C2 | W/P | Learning + Support | O,U,M |
| CAP-007 | Tonight | Student OS | S | early_access | Planning implementation/tests | ST/LS | C2 | W/P | Learning product | O,U,M |
| CAP-008 | Timers and Alarms | Productivity | S | early_access | Browser timer behavior | LS | C1 | W/P | Product | O,U,R |
| CAP-009 | Progress | Student OS | S | early_access | Local progress/tests | ST/LS | C2 | W/P | Product + Data | O,U,M |
| CAP-010 | Account | Identity | S/F/A/G/I/P/O | early_access | Supabase/account code and policy; production operation not re-proved here | IP/ST | C1/C3 | W/P | Identity + Security | O,U,R,T,X |
| CAP-011 | Profile | Identity | S | early_access | Profile UI/local/server paths | ST | C2 | W/P | Identity + Privacy | O,U,T,M |
| CAP-012 | Links | Campus/productivity | S | early_access | Local saved links | ST/LS/PUB | C1 | W/P | Product | O,U |
| CAP-013 | Connect Accounts | Integration | S/I | institution_controlled | OAuth/connection models; not all providers live | IP | C3 | W/P | Integrations + Security | O,U,R,T,V,X,D |
| CAP-014 | Your Data and How It Is Running | Trust/data | S/I | early_access | Data/source UI and docs | ST/IP | C3 | W/P | Privacy + Data | O,U,T,V |
| CAP-015 | Privacy and Your Rights | Trust/data | S | early_access | Rights UI, export/deletion foundations | ST/IP | C3 | W/P | Privacy + Support | O,U,R,T,C,D |
| CAP-016 | Take It With You | Trust/data | S | early_access | Export/restore validation paths | ST/LS | C2/C3 | W/P | Privacy + Engineering | O,U,R,D |
| CAP-017 | Settings | Core | S | early_access | Preference implementation/tests | ST/LS | C1/C2 | W/P | Product | O,U |
| CAP-018 | Alerts | Notifications | S/I | early_access | Browser/push/preferences foundations | ST/IP | C2/C3 | W/P | Comms + Operations | O,U,R,T,V,D |
| CAP-019 | How This Works | Product education | All | early_access | Help/onboarding content | PUB | C0 | W/P | Product + Support | O,U,M |
| CAP-020 | Courses | Student OS | S/F | early_access | Student course model and source labels | ST; LMS when connected | C2/C3 | W/P | Academic product | O,U,T,V,D |
| CAP-021 | Assignments | Student OS | S/F | early_access | Student/local assignment flows | ST; LMS when connected | C2/C3 | W/P | Academic product | O,U,T,V,D |
| CAP-022 | Add a Course | Academic ingestion | S | early_access | Import/generation/review tests | ST | C2 | W/P | Academic product + AI | O,U,R,M |
| CAP-023 | Edit the Course | Academic ingestion | S | early_access | Local editing/tests | ST | C2 | W/P | Academic product | O,U,D |
| CAP-024 | A Change to a Date | Academic ingestion | S | early_access | Local correction workflow | ST | C2 | W/P | Academic product | O,U,D |
| CAP-025 | Study | Learning | S | early_access | Broad study modes/tests | ST | C2 | W/P | Learning product | O,U,M |
| CAP-026 | Where Courses Meet | Learning | S | early_access | Local source comparison | ST | C2 | W/P | Learning product | O,U,M |
| CAP-027 | Semester Tutor | AI | S | early_access | Policy, source grounding, kill switch | ST/IP | C2/C3 | W/P | AI + Security | O,U,R,T,V,M,C,X |
| CAP-028 | Add a Reading | Academic ingestion | S | early_access | Local upload/extraction | ST | C2 | W/P | Learning product | O,U,R |
| CAP-029 | Problem Practice | Learning | S | early_access | Practice implementation/tests | ST | C2 | W/P | Learning product | O,U,M |
| CAP-030 | Practice Exams | Learning | S | early_access | Practice implementation/tests | ST | C2 | W/P | Learning product | O,U,M |
| CAP-031 | Create | Productivity | S | early_access | Student creation workspace | ST/LS | C2 | W/P | Productivity product | O,U,R,N |
| CAP-032 | Analyse Data | Productivity | S | early_access | Client-side analysis/tests | ST/LS | C2 | W/P | Productivity product | O,U,R |
| CAP-033 | Graphs and Diagrams | Productivity | S | early_access | Client-side authoring/tests | ST/LS | C2 | W/P | Productivity product | O,U,R |
| CAP-034 | Presentations | Productivity | S | early_access | Client-side authoring/export | ST/LS | C2 | W/P | Productivity product | O,U,R,N |
| CAP-035 | Documents | Productivity | S | early_access | Client-side authoring/export | ST/LS | C2 | W/P | Productivity product | O,U,R,N |
| CAP-036 | Spreadsheets | Productivity | S | early_access | Client-side authoring/export | ST/LS | C2 | W/P | Productivity product | O,U,R,N |
| CAP-037 | Maths | Productivity | S | early_access | Client-side math tools/tests | ST/LS | C2 | W/P | Productivity product | O,U |
| CAP-038 | Sources | Academic integrity | S | early_access | Citation/source tooling | ST | C2 | W/P | Trust + Learning | O,U,M |
| CAP-039 | Draft It | Productivity/AI | S | early_access | Drafting and policy controls | ST/IP | C2 | W/P | Productivity + AI | O,U,R,M,C |
| CAP-040 | Files and Notes | Productivity | S | early_access | Local files/notes/export | ST/LS | C2 | W/P/N | Productivity + Storage | O,U,R,N,D |
| CAP-041 | Family | Family | S/G/I | institution_controlled | Local planner, sandbox grant, DB foundations | ST/SYN; institution policy required | C3/C4 | W/P | Privacy + Institution success | O,U,R,T,V,C,X,D |
| CAP-042 | Athletics | Campus | S | early_access | Product UI/data fixtures | PUB/ST | C1/C2 | W/P | Campus product | O,U,V,M |
| CAP-043 | Campus Services | Campus/support | S/I | institution_controlled | Service directory/workflow concepts | PUB/SYN | C2/C3 | W/P | Campus + Institution success | O,U,R,T,V,D |
| CAP-044 | Degree Planning | Academic records | S/A/I | institution_controlled | What-if planning; official disclaimer | ST/SYN; SIS required | C3 | W/P | Registrar integration | O,U,R,T,V,C,X,D |
| CAP-045 | Term Deadlines | Academic records | S/I | institution_controlled | Source-aware dates; no universal feed | PUB/SIS | C3 | W/P | Registrar integration | O,U,R,T,V,D |
| CAP-046 | Money | Financial life | S/G/I | institution_controlled | Cost explanations/sandbox only | ST/SYN; ERP/aid required | C4 | W/P | Finance + Privacy | O,U,R,T,V,M,C,X,D |
| CAP-047 | Meal Plan | Campus/financial | S/G/I | institution_controlled | Estimates/sandbox concepts | SYN; campus card required | C4 | W/P | Campus card + Finance | O,U,R,T,V,C,X,D |
| CAP-048 | Housing | Campus | S/I | institution_controlled | Preferences/planning/sandbox | ST/SYN; housing required | C3/C4 | W/P | Housing + Privacy | O,U,R,T,V,C,X,D |
| CAP-049 | Maps | Campus | S | early_access | Campus map/search and route estimates | PUB/ST | C1/C2 | W/P | Campus product + Accessibility | O,U,V,M |
| CAP-050 | Registration | Academic records | S/A/I | institution_controlled | Planning/sandbox; official writes blocked | SYN; SIS authoritative | C4 | W/P | Registrar + Integrations | O,U,R,T,V,C,X,D |
| CAP-051 | Clubs and Activities | Campus/community | S/I | institution_controlled | UI/community schema; source-dependent | PUB/SYN | C2/C3 | W/P | Community + Trust | O,U,R,T,V,M,X |
| CAP-052 | People and Letters | Career | S/A | early_access | Student planning/drafts | ST | C2 | W/P | Career product | O,U,M,D |
| CAP-053 | Pathway | Lifecycle | S/A | early_access | Student-owned pathway planning | ST | C2 | W/P | Journey product | O,U,M |
| CAP-054 | Career | Career | S/A/P | early_access | Student profile/career planning | ST | C2 | W/P | Career product | O,U,M,C |
| CAP-055 | Applications | Opportunities | S/P | early_access | Personal tracking; no automatic submission | ST | C2 | W/P | Career + Marketplace | O,U,R,M,C,D |
| CAP-056 | Check the Writing | Academic integrity/AI | S | early_access | Quote/citation/source checks | ST | C2 | W/P | Learning trust | O,U,M,C |
| CAP-057 | Video Call | Communications | S/F/A | early_access | Browser calling/provider-dependent | IP | C2/C3 | W/P | Communications + Security | O,U,R,T,V,D |
| CAP-058 | Group Work | Collaboration | S/F | early_access | Membership/sync concepts; no CRDT service | ST/SYN | C2/C3 | W/P/N | Collaboration product | O,U,R,T,X,N,D |
| CAP-059 | Email | Communications | S/F/A/I | institution_controlled | UI/provider connection foundations | IP | C3 | W/P | Communications + Institution | O,U,R,T,V,C,D |
| CAP-060 | Chat | Communications | S/F/A | early_access | Membership-aware local/partial messaging | ST/SYN | C2/C3 | W/P | Communications + Trust | O,U,R,T,V,X,D |

## Platform capabilities not represented as one of the 60 user-facing rows

These shared capabilities must also receive operational records in the first implementation PR. The conservative Phase A status is shown below; none is promoted to `live` from repository evidence alone.

| Shared capability | Phase A status | Primary entities | Actors | Value metric | Failure/fallback | Audit/support owner |
| --- | --- | --- | --- | --- | --- | --- |
| Identity lifecycle | institution_controlled | person, identity, session, recovery factor | all | successful sign-in/recovery, lockout rate | deny protected access; recovery path | Identity/Security + Support |
| Tenant provisioning | institution_controlled | tenant, organization, membership, role | I/O | setup lead time, configuration defects | no activation; sandbox/manual review | Institution Ops + Security |
| Entitlement/capability activation | institution_controlled | capability, evidence, entitlement, cohort | I/O | denied overclaims, rollback time | fail closed to planned/control state | Product Ops + Security |
| Global search/command | early_access | authorized resource projection, source, freshness | S/F/A/I/O | task success, zero auth divergence | local/official links; omit unavailable sources | Product + Search/AI Security |
| Notification delivery/inbox | early_access | preference, message, delivery, receipt | S/F/A/G/I | delivery latency, preference compliance | in-app status/official channel | Communications Ops + Support |
| Support case management/JIT access | institution_controlled | case, grant, justification, access event | S/I/O | resolution, grant expiry, access exceptions | no content access; escalation | Support + Privacy/Security |
| Trust center/data rights | early_access | consent, export, deletion, retention, hold | S/G/I/O | request completion and exceptions | clear pending/denied receipt | Privacy + Support |
| Operations console | institution_controlled | tenant, health, evidence, incident, audit | O/I | detection/response, stale evidence | read-only/degraded controls | Operations + Security |
| Audit/outbox | institution_controlled | audit event, outbox event, correlation ID | I/O | coverage, delivery lag, replay safety | fail/queue sensitive action as policy requires | Security + SRE |
| Integration health/reconciliation | institution_controlled | connection, sync run, mapping, receipt | I/O | freshness, error and reconciliation rates | stale label, official-system handoff | Integrations + Institution Ops |
| Analytics taxonomy | planned_but_not_exposed | event, taxonomy version, consent, metric | O/I | event validity, privacy budget | disable collection; use aggregate/manual evidence | Data + Privacy |
| Incident/recovery | institution_controlled | incident, runbook, backup, restore evidence | O/I | MTTD/MTTR/RPO/RTO | kill switch, restore/rollback | Operations + Security |
| Marketplace partner verification | planned_but_not_exposed | partner, listing, application, disclosure | S/P/I/O | verified supply, safe applications | hide listing; no disclosure | Marketplace Trust + Support |
| AI policy/tool audit | institution_controlled | policy, decision, tool call, confirmation | S/F/A/I/O | grounded success, denied unsafe action | no-answer/manual/official handoff | AI + Security/Privacy |
| Native secure storage | planned_but_not_exposed | device installation, key ref, cache item | S | unlock/rekey/wipe success | online/PWA only | Mobile + Security |
| CRDT replication | planned_but_not_exposed | document, collaborator, update, state vector | S/F | convergence and lost-edit rate | single-user/versioned editing | Collaboration + Support |
| Credential wallet portability | planned_but_not_exposed | issuer, credential, holder, presentation consent | S/P/I | verified imports/presentations | issuer link/manual record | Journey + Trust |

## Cross-cutting evaluation contract

For each of the 60 rows, `Roles` identifies the facing actors and authorization boundary; `Source` identifies the controlling entity/source family; `Status` is the exposure decision; `Platform` states the current/target mobile stance; and `Missing operational tests` states why it cannot be promoted. Every row additionally inherits these required proofs:

- Value: task completion, time-to-value, error/recovery rate, retention and a domain outcome chosen before activation; engagement alone is insufficient.
- Permission: person, tenant, active membership, role/relationship, purpose, consent, entitlement, classification and capability status must resolve server-side where protected data is involved.
- Unavailable dependency: retain student-owned work, label stale/unavailable sources, link to the authoritative system and never manufacture success.
- Audit/support: policy-sensitive reads/writes record request/correlation ID, source/policy versions and decision; each capability requires named product, engineering, privacy/security, support and rollback seats before `live`.
