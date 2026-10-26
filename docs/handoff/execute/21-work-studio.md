# Stream 21: Semester Work Studio and Semester Intelligence

Branch `semester/work-studio` from `origin/main`. Depends on streams 01 (platform core) and 02 (identity). Read `handoff/BUILD.md` "Read this first" before starting: **the live repo wins every conflict**; extend its authorization core, schema and design system instead of creating parallel ones.

## Inputs
- Prototype files (acceptance reference, not code to ship): `ui_kits/semester-app/StudioA.jsx`, `ui_kits/semester-app/StudioB.jsx`, `ui_kits/semester-app/StudioC.jsx`, `ui_kits/semester-app/StudioD.jsx`, `ui_kits/semester-app/StudioE.jsx`, `ui_kits/semester-app/StudioF.jsx`, `ui_kits/semester-app/StudioG.jsx`, `ui_kits/semester-app/StudioH.jsx`, `ui_kits/semester-app/IntelRoles.jsx`
- Source specifications (copy to `docs/specifications/source/`): `work-create-studio.pdf`; `Semester Work Studio UI Spec.pdf`; `Semester Work Studio Prototype Spec.pdf`; `studio-collab-arch.pdf`; `x-studio-prod.pdf, x-studio-sync.pdf, Analytics dashboard_…pdf ((1) copy identical to earlier)`; `x-studio-recovery.pdf`; `x-awareness-leak.pdf`; `studio-crdt-publishing.pdf`
- Screen list with components: `handoff/prototype/SCREEN-INVENTORY.md` (filter Stream = 21)
- Design rules and tokens: `readme.md`, `SKILL.md`, `styles.css`

## Also: Semester Brain
`#/student/brain` (BrnToday in `ui_kits/semester-app/OpsConsole.jsx`). Spec: `Perplexity Semester Brain Instructions.pdf`. Daily view of 3–5 actions max ordered by the 5-level priority (safety/permissions → imminent submissions, classes, reviews → blocked requirements and citations → declared goals and calendar → optional); every item names its evidence and has “Why this?”; suggestions labelled; facts separate from suggestions; uncertainty stated (“I could not confirm”); confirmation before any external action; context switches for private notes, personal folders and DMs are off unless the student allows them; never infers health, finances, disability, risk or relationships; never decides grades, discipline, enrollment, aid or eligibility. Brain is a hub with three tabs: Today; Ask (mode chips Plan/Assignment/Research/Study, conversation, “Context used for this answer” checkboxes with View data used and Clear; refuses grade prediction); Weekly digest (pause, day/time, work/personal/career off by default, max 3 actions, 3 dates, 2 risks, sources on every action). Spec: `Alert me on Yjs awareness metrics breaches_Automat.pdf` (Brain sections) — `BrainHub.jsx`.

## Screens to build (32)

| Route in prototype | Screen | Prototype component |
| --- | --- | --- |
| `#/faculty/assistant` | Instructor Assistant | SixInstructor (IntelRoles.jsx) |
| `#/studio/home` | Studio home | StaHome (StudioA.jsx) |
| `#/studio/files` | My Work | StaFiles (StudioA.jsx) |
| `#/studio/make` | Make | StaMake (StudioA.jsx) |
| `#/studio/assignment` | Assignment workspace | StaAssignment (StudioA.jsx) |
| `#/studio/research` | Research Studio | StbResearch (StudioB.jsx) |
| `#/studio/calendar` | Calendar | StbCalendar (StudioB.jsx) |
| `#/studio/assistant` | Executive Assistant | StbAssistant (StudioB.jsx) |
| `#/studio/intelligence` | Intelligence | StbIntel (StudioB.jsx) |
| `#/studio/policy` | AI Policy Center | StbPolicy (StudioB.jsx) |
| `#/studio/course` | ECON 201 folders | StcCourse (StudioC.jsx) |
| `#/studio/doc` | Document | StcDoc (StudioC.jsx) |
| `#/studio/sheet` | Spreadsheet | StcSheet (StudioC.jsx) |
| `#/studio/slides` | Presentation | StcSlides (StudioC.jsx) |
| `#/studio/share` | Share panel | StcShare (StudioC.jsx) |
| `#/studio/ask` | Assistant request gate | StcAsk (StudioC.jsx) |
| `#/studio/sync` | Offline sync | StdSync (StudioD.jsx) |
| `#/studio/branches` | Versions and branches | StdBranches (StudioD.jsx) |
| `#/studio/math` | Math canvas | StdMath (StudioD.jsx) |
| `#/studio/session` | Live session | SteSession (StudioE.jsx) |
| `#/studio/grading` | Grading stream | SteGrading (StudioE.jsx) |
| `#/studio/export` | Citations and export | SteExport (StudioE.jsx) |
| `#/studio/tutor` | Learning Tutor | SixTutor (IntelRoles.jsx) |
| `#/studio/vectors` | State vectors | SixVectors (IntelRoles.jsx) |
| `#/studio/buildqueue` | Export queue | StfBuild (StudioF.jsx) |
| `#/studio/gateways` | Sync gateways | StfGateways (StudioF.jsx) |
| `#/studio/worker` | Worker | StfWorker (StudioF.jsx) |
| `#/studio/peers` | Peer and Friend | StfPeers (StudioF.jsx) |
| `#/studio/recovery` | Recovery simulator | StgSim (StudioG.jsx) |
| `#/studio/litreview` | Literature review | StgLit (StudioG.jsx) |
| `#/studio/presence` | Presence audit | SthAudit (StudioH.jsx) |
| `#/studio/tools` | All tools | SthTools (StudioH.jsx) |

## Behaviors to reproduce
Each bullet is the as-built prototype behavior. Implement it against real data and services; where the prototype simulates (timers, toggles, fake servers), build the real mechanism and keep the toggle as a test fixture.

- **Studio H (6 Oct):** StudioH.jsx (STH*): #/studio/presence (6-state awareness machine with join/close/+15s/GC, inject 7 leak types → alerts → GC remediation, capacity estimator), #/studio/tools (suite catalog: built Doc/Sheet/Slides/Math + Form, Design, Video, Notes, Study Guide, Code/Lab with live notebook run history + tests; 10 shared capabilities). From x-awareness-leak.pdf.
- **Studio G (6 Oct):** StudioG.jsx (STG*): #/studio/recovery (6 failure scenarios × clients slider → converged / lost updates / recovery s, simulated), #/studio/litreview (literature review matrix + claims with importance/status/evidence, central-unsupported warning, integrity). From x-studio-recovery.pdf.
- **Studio F (6 Oct):** StudioF.jsx (STF*): #/studio/buildqueue (export job state machine queued→completed, priorities, idempotency key, simulated missing-citation / compile-with-2-retries / timeout → DLQ), gateways (3-gateway Redis fan-out path, durable append first, revoked member not forwarded), worker (jobs/applications + portfolio suggestion with why), peers (opt-in partner matching hiding schedules until accepted, 25-min focus room, links). Feed analytics: reconcile purges only server-marked unavailable posts. From x-studio-prod.pdf, x-studio-sync.pdf, Analytics dashboard_…pdf ((1) copy identical to earlier).
- **Intelligence roles (6 Oct):** IntelRoles.jsx (SIX*): #/studio/tutor (course AI policy badge, 3 progressive hints before full explanation with sources, explain-it-back check, Planning-only course blocks it, other modes route), #/faculty/assistant (announcement/FAQ/rubric drafts → approve/discard; never grades), #/studio/vectors (state-vector exchange demo, duplicate send is a no-op). mobile.html jump links + Tutor, Analytics. From studio-crdt-publishing.pdf.
- **Studio E (6 Oct):** StudioE.jsx (STE*): #/studio/session (10-step join handshake, role-removed / submission-locked refusals, CRDT vs server-authoritative data), grading (12-state stream, rubric criteria linked to evidence, scores hidden until release, revision branch, 7-role matrix), export (BibTeX import with parse + warnings, CSL style, 10-step Pandoc/LaTeX pipeline animation, export manifest). From studio-collab-arch.pdf.
- **Studio D (6 Oct):** StudioD.jsx (STD*): #/studio/sync (two-device CRDT-style simulator: local-first edits, offline queue, reconnect merge, permission-revoked recovery copy, event log, semantic-conflict table), branches (named + auto checkpoints, 5 branch types with merge/discard, immutable submission snapshot with hash), math (block canvas with live scatter + fitted line sliders and RSS), studio home gains workload chart. From Semester Work Studio Prototype Spec.pdf.
- **Studio C (6 Oct):** StudioC.jsx (STC*): #/studio/course (ECON 201 folder hierarchy with owner/access/upload/edit rules; blocked upload explains why), share (inherited-from path, group/course/direct sources, roles, download/reshare/expiry, external share blocked by instructor lock), doc (autosave, presence, editing/suggesting/viewing, comments → tasks, version history with submitted snapshot locked + restore notice, file details), sheet (editable cells, validation, means by treatment, blanks excluded), slides (rail with slide owners, rehearsal timer, notes, checks), ask (5 requests → permit/constrain/refuse by course AI policy + context access table). From Semester Work Studio UI Spec.pdf.
- **Semester Studio (6 Oct):** StudioA.jsx (STA*) + StudioB.jsx (STB*), new workspace `studio` (+ #/studio alias): home (continue, due next, Make launcher), files (course folder tree, tags, stars, organize suggestion that asks first), make (kind → course/project → goal → template → next steps), assignment (Overview/Work/Research/Rubric/Self-check/AI policy/Feedback, checklist, confirm-before-submit), research (question, sources, claims linked to evidence with unsupported warning, outline, citations), calendar (week/agenda, 6 source colors, conflict detection, suggested focus block), assistant (daily briefing, editable plan, pause, why, history; never acts without confirmation), intelligence (7 insights each toggleable with source), policy (5 AI modes per course + disclosure log). From work-create-studio.pdf.

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
- [ ] Report written to `docs/execute/21-work-studio-report.md` with evidence; PR opened; STOP for human review
