# The benchmark register

<!-- Rendered from app/src/lib/benchmark.ts by benchmark.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

The strategy brief’s six public commitments and twenty-five initiatives, each
broken into the brief’s own checkable items and each item marked with what
the tree holds. An item in place cites the thing, never a page about it; an
owed item says what would close it.

**19 of 39 items are in place, 17 are partial and 3 are owed.**
Nothing at all is in place in 13 initiatives: 2 (Universal “one-click clarity” layer); 4 (Document intelligence with human review); 5 (“Explain my options” planner); 9 (Instructor-controlled AI learning spaces); 11 (Accessibility authoring intelligence); 12 (Student experience orchestration layer); 14 (Institutional content quality score); 15 (Open data and portability architecture); 19 (Open product quality report); 20 (Academic navigation index); 21 (“Trust score” for internal operations, not students); 22 (Control-plane simulation); 25 (An annual flagship event).

## The commitments

### The clearest student experience

> Students always know what matters next, and every recommendation is explainable; the app is calm and essential, never noisy, addictive or surveillance-driven.

- 1. Personal academic operating system
- 2. Universal “one-click clarity” layer
- 3. “Bring your whole academic life” importer
- 4. Document intelligence with human review
- 5. “Explain my options” planner
- 6. A student “support network” map
- 8. “Teach-back” and metacognition mode
- 13. “No wrong door” support experience

### The most transparent data and AI experience

> Every fact has a source, every estimate is honest, every share is controlled, and every AI action is governed and inspectable.

- 7. AI confidence and quality controls visible to users
- 9. Instructor-controlled AI learning spaces

### The most accessible learning platform

> Every accessibility need is treated as ordinary product quality, visible everywhere, never hidden in settings.

- 10. Accessibility as a visible product feature
- 11. Accessibility authoring intelligence

### The most interoperable university platform

> Every integration is observable, every institution retains authority, and interoperability is a customer right rather than an upsell.

- 12. Student experience orchestration layer
- 14. Institutional content quality score
- 15. Open data and portability architecture

### The most operationally reliable academic platform

> Every operational promise has evidence, every staff member sees only what they need, and a change is simulated before it is made.

- 16. Policy simulator
- 17. Synthetic data and digital-twin environment
- 21. “Trust score” for internal operations, not students
- 22. Control-plane simulation

### The most accountable edtech company

> Every public claim has evidence, every gap is disclosed where the claim is, and the standard is operationalised before it is marketed.

- 18. Public “Semester Standard”
- 19. Open product quality report
- 20. Academic navigation index
- 23. Customer trust dashboard
- 24. Own the language
- 25. An annual flagship event

## The initiatives

### 1. Personal academic operating system

The clearest student experience · 3 of 4 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B01-1 | Morning: today briefing, what changed, next class, deadlines, study prompt, schedule balance. | in place | [`app/src/lib/since.ts`](../../app/src/lib/since.ts) | Today leads with one next step; “since you last opened” lists what changed with source and freshness; balance and crunch-week are modules. |
| B01-2 | During the day: course context, assignment work, study support, Ask Semester, meeting prep, quick capture. | in place | [`app/src/ai/shape.ts`](../../app/src/ai/shape.ts) | Every screen hands the assistant what it is showing; courses, study, advising prep and capture are screens. |
| B01-3 | End of day: review actions, prepare tomorrow, save materials, plan study blocks, reflect and reset. | partial | [`app/src/screens/report/Day.tsx`](../../app/src/screens/report/Day.tsx) | The day report reviews what happened; “prepare tomorrow” and “reflect and reset” are not one flow. |
| B01-4 | Calm and essential — never noisy, addictive or surveillance-driven. | in place | [`app/src/lib/notify.ts`](../../app/src/lib/notify.ts) | Five important and one helpful notification a day, quiet hours, and the engagement rules the ethics document sets. |

### 2. Universal “one-click clarity” layer

The clearest student experience · 0 of 2 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B02-1 | A consistent explain panel on every object: what, why, where from, how current, who can see, what can I do, what happens if I act, can I undo, who can help. | partial | [`app/src/lib/explain.ts`](../../app/src/lib/explain.ts) | About this screen answers four of the nine on every screen, and source/scope/status answers three more per fact. “What happens if I act” and “can I undo” are answered per action, not in the panel. |
| B02-2 | On every object type: course, requirement, deadline, action, recommendation, AI answer, assignment, grade, source, share, integration, notification, policy, credential. | partial | [`app/src/lib/provenance.ts`](../../app/src/lib/provenance.ts) | Facts, shares, AI answers and screens carry it; notifications, policies and credentials do not yet. |

### 3. “Bring your whole academic life” importer

The clearest student experience · 1 of 2 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B03-1 | Import or connect: syllabus, degree audit, transcript, schedule, calendar, PDFs and slides, notes, actions, résumé, portfolio, past projects, course exports. | partial | [`app/src/screens/Import.tsx`](../../app/src/screens/Import.tsx) | Syllabi, calendars, files, notes and course exports import; degree audit, transcript and résumé do not. |
| B03-2 | Every import is reviewable, source-labelled, editable, privacy-controlled, revocable, deletable, never auto-applied to official records. | in place | [`app/src/lib/source.test.ts`](../../app/src/lib/source.test.ts) | Every imported fact carries its label and is editable and deletable; nothing writes to an official record (no write scope exists). |

### 4. Document intelligence with human review

The clearest student experience · 0 of 2 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B04-1 | Upload a syllabus → detect deadlines, policies, outcomes, weights, accessibility notes → extraction review → confirm → create actions, schedule, study plan, companion → preserve page anchors. | partial | [`app/src/lib/cite.ts`](../../app/src/lib/cite.ts) | Deadlines, weights and material are extracted with anchors and confirmed on import; accessibility notes and outcomes are not detected. |
| B04-2 | Works for PDF, DOCX, PPTX, images, audio, video, CSV, spreadsheet, web page, course export. | partial | [`app/src/lib/docxin.ts`](../../app/src/lib/docxin.ts) | PDF, DOCX, PPTX, CSV, spreadsheets and course exports read; images, audio and video are captured, not read for structure. |

### 5. “Explain my options” planner

The clearest student experience · 0 of 2 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B05-1 | Compare course vs course, major vs major, full- vs part-time, abroad vs campus, minor vs earlier, work vs load, internship vs summer, transfer vs repeat. | partial | [`app/src/components/GraduationSimulator.tsx`](../../app/src/components/GraduationSimulator.tsx) | Term-load and summer scenarios compare; major, abroad and transfer comparisons do not exist. |
| B05-2 | Show requirement, schedule, workload, cost impact, career evidence, source authority, assumptions, what needs official approval; never present an estimate as a guaranteed outcome. | partial | [`app/src/lib/graduation.ts`](../../app/src/lib/graduation.ts) | Requirement, schedule and cost impact are shown as estimates and never called official; career evidence and “what needs approval” are not in the comparison. |

### 6. A student “support network” map

The clearest student experience · 2 of 2 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B06-1 | For a question, the right people: advisor, office hours, tutor, writing center, library, accessibility office, career coach, aid, registrar, international office, accounts, wellbeing through official routes. | in place | [`app/src/lib/help-routes.ts`](../../app/src/lib/help-routes.ts) | Eleven destination kinds, three directory-only; wellbeing routes to campus counseling and 988 and stores nothing. |
| B06-2 | Route, prepare and document the next step — not replace professional support. | in place | [`app/src/lib/nowrongdoor.ts`](../../app/src/lib/nowrongdoor.ts) | A summary to take along and the line that Semester never decides, on every door. |

### 7. AI confidence and quality controls visible to users

The most transparent data and AI experience · 4 of 4 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B07-1 | Source strength: strong, limited, none. | in place | [`app/src/ai/quality.test.ts`](../../app/src/ai/quality.test.ts) | Derived from what the answer read and how many sources were available. |
| B07-2 | Policy state: allowed, limited, unavailable for this request. | in place | [`app/src/ai/quality.test.ts`](../../app/src/ai/quality.test.ts) | Derived from the help state the composer already obeys. |
| B07-3 | Confidence language: what Semester can support, cannot determine, needs official or human confirmation. | in place | [`app/src/ai/Turns.tsx`](../../app/src/ai/Turns.tsx) | Three sentences under every reply, in a native disclosure. |
| B07-4 | Feedback: helpful, not helpful, incorrect, source issue, policy issue, accessibility issue. | in place | [`app/src/ai/quality.ts`](../../app/src/ai/quality.ts) | Two local marks and four that open the report the app already sends, on the right kind. |

### 8. “Teach-back” and metacognition mode

The clearest student experience · 1 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B08-1 | Student explains in text, audio or outline → Semester names missing ideas → asks follow-ups → links to source → creates review items → tracks confidence; never scores intelligence. | in place | [`app/src/lib/teachback.ts`](../../app/src/lib/teachback.ts) | No grade, no model answer, nothing unquoted, and a contradiction quotes both sides. |

### 9. Instructor-controlled AI learning spaces

The most transparent data and AI experience · 0 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B09-1 | Per course: approved source set, allowed AI modes, assignment restrictions, citation style, practice boundaries, feedback rules, retention, course-specific prompts, faculty-approved study packs. | partial | [`app/src/lib/coursestudio.ts`](../../app/src/lib/coursestudio.ts) | Rules, packs and versions publish from Course Studio behind a flag; retention and feedback rules per course are not fields yet. |

### 10. Accessibility as a visible product feature

The most accessible learning platform · 1 of 2 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B10-1 | Read aloud, focus mode, high contrast, text spacing, dyslexia support, captions, transcripts, plain-language summaries, reading time, shortcut panel, accessible math, charts, list views, no drag-only planning. | partial | [`app/src/lib/aloud.ts`](../../app/src/lib/aloud.ts) | Read aloud, focus bar, contrast, spacing, typeface, captions, transcripts, shortcuts and list views exist and sit under Me and About this screen; reading-time estimates and accessible math are not built. |
| B10-2 | Not hidden in settings: useful everywhere. | in place | [`app/src/lib/mecontrols.ts`](../../app/src/lib/mecontrols.ts) | Accessibility preferences are one row under Me, and About this screen is on every screen. |

### 11. Accessibility authoring intelligence

The most accessible learning platform · 0 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B11-1 | For material creators: heading, alt-text, link-text, contrast, table-header, caption, reading-order, PDF, assessment, slide and chart checks — labelled guidance, not certification. | owed | — | Nothing checks generated or authored material for structure; the maturity register carries it as GA-01 to GA-03. |

### 12. Student experience orchestration layer

The most interoperable university platform · 0 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B12-1 | Official action feed: source approved by office owner, cohort targeting, action-center delivery, student-facing explanation, privacy thresholds, completion aggregation, office handoff, feedback loop. | partial | [`docs/OFFICE-ACTION-FEED.md`](../OFFICE-ACTION-FEED.md) | The feed is built behind a flag with source and explanation; cohort targeting at n ≥ 10 and completion aggregation are designed; no office publishes to it. |

### 13. “No wrong door” support experience

The clearest student experience · 1 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B13-1 | Describe a problem in plain language; Semester clarifies what it can, identifies the owner, prepares a summary, offers safe next actions, routes to official systems or a person; never decides. | in place | [`app/src/lib/nowrongdoor.test.ts`](../../app/src/lib/nowrongdoor.test.ts) | The brief’s six sentences route correctly; distress routes first; nothing typed is stored. |

### 14. Institutional content quality score

The most interoperable university platform · 0 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B14-1 | For campus content: owner, last reviewed, accessibility status, source, freshness, audience, expiry, usage, feedback, broken links, policy relevance. | owed | — | Tier-1 content settings carry owner and expiry limits; nothing scores an institution’s content. Follows the first published resource. |

### 15. Open data and portability architecture

The most interoperable university platform · 0 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B15-1 | Student-controlled export, institution export, documented APIs, open standards, no hidden lock-in, migration tools, offboarding support, credential portability, versioned data contracts. | partial | [`docs/DATA-PORTABILITY-AND-OFFBOARDING.md`](../DATA-PORTABILITY-AND-OFFBOARDING.md) | Student export and deletion are self-serve on every plan; data contracts are code; institution export, migration tools and credential portability are designed. |

### 16. Policy simulator

The most operationally reliable academic platform · 2 of 2 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B16-1 | Before enabling a policy, simulate: who sees the change, workflows affected, alternatives, support content to update, audit event created. | in place | [`app/src/lib/governance/policysim.test.ts`](../../app/src/lib/governance/policysim.test.ts) | Every module, on screens that exist, with support paths that exist and the reviewers the tier needs. |
| B16-2 | Retention 365 → 180: data classes affected, exports and deletions that change, contracts to review. | in place | [`app/src/lib/governance/policysim.test.ts`](../../app/src/lib/governance/policysim.test.ts) | Every clock from the retention schedule; a clock on student work is refused, and so is one under its legal floor. |

### 17. Synthetic data and digital-twin environment

The most operationally reliable academic platform · 1 of 2 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B17-1 | A fictional tenant with fictional students, faculty, courses, integrations, source freshness, incidents, support access, AI policy and billing, for demos, UAT, training, accessibility and security testing, drills, integration development and release validation. | partial | [`app/src/lib/flight-plan.ts`](../../app/src/lib/flight-plan.ts) | Demo tenants with invented data run every institutional screen; a processing sandbox for sync, incidents and billing is designed in the sync-simulation document. |
| B17-2 | Real student data is never required for testing or demonstrations. | in place | [`app/src/lib/masterregister.ts`](../../app/src/lib/masterregister.ts) | PRG-008, demo-data isolation, is tested; the demo is labelled demo data by test on the site. |

### 18. Public “Semester Standard”

The most accountable edtech company · 1 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B18-1 | /semester-standard: a public standard with measurable commitments — sources, limitations, sharing control, keyboard, AI context, incident path, export, audit, evidence. | in place | [`app/src/lib/standard.test.ts`](../../app/src/lib/standard.test.ts) | Eleven lines, four held by a test, seven partly held with the gap printed on the page; annual progress is stated as owed until a year has passed. |

### 19. Open product quality report

The most accountable edtech company · 0 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B19-1 | /transparency/product-quality: accessibility, reliability, trust-center changes, security reviews, data-request performance, AI evaluation, integration changes, known limitations, feedback themes — published when real. | partial | [`app/src/site/more.tsx`](../../app/src/site/more.tsx) | The page exists at /trust/product-quality/ with what is checked, known and deliberately not published; no measure is published because none is real yet. |

### 20. Academic navigation index

The most accountable edtech company · 0 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B20-1 | Public research on how students navigate registration, where friction appears, what they cannot find, how transparency affects trust, how accessibility affects action, how AI-policy clarity affects course use. | partial | [`app/src/site/benchmark.tsx`](../../app/src/site/benchmark.tsx) | The Academic Friction Index is published as a method with nine questions and no findings; the navigation diagnostic is the self-assessment an institution can run today. |

### 21. “Trust score” for internal operations, not students

The most operationally reliable academic platform · 0 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B21-1 | A readiness score per tenant, connector, release or feature: security, privacy, accessibility, integration health, data quality, support, documentation freshness, SLO health, training, contract alignment — never scoring students. | partial | [`app/src/lib/governance/release-readiness.ts`](../../app/src/lib/governance/release-readiness.ts) | Release readiness scores eight dimensions with a floor; data contracts report unstaffed; no per-tenant or per-connector score composes them. |

### 22. Control-plane simulation

The most operationally reliable academic platform · 0 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B22-1 | Before production changes: preview configuration, run policy, permission, data-quality, accessibility and integration tests, estimate customer impact, require approval, canary, monitor, roll back. | partial | [`app/src/components/institutional/ControlPlane.tsx`](../../app/src/components/institutional/ControlPlane.tsx) | Preview (the simulator), approval by tier and a gateway receipt exist; permission and data-quality tests, canary and rollback of a tenant change are designed. |

### 23. Customer trust dashboard

The most accountable edtech company · 1 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B23-1 | Per institution: version, modules, integrations and freshness, open issues, limitations, trust documents, accessibility status, maintenance, retention, AI policy, feature changes, usage aggregates. | in place | [`app/src/lib/trustdashboard.test.ts`](../../app/src/lib/trustdashboard.test.ts) | Twelve rows composed from what the app knows, an absence said plainly, usage suppressed under n = 10; a Trust tab on the institution screen. |

### 24. Own the language

The most accountable edtech company · 1 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B24-1 | Use and repeat: Student Action Layer, Academic Navigation, Source-Aware Student Experience, Governed Campus AI, No Wrong Door, Student Data Agency, Accessible University OS, Decision Packets, Trust by Design. | in place | [`app/src/lib/vocabulary.test.ts`](../../app/src/lib/vocabulary.test.ts) | Nine terms, each on a home page that a test holds to print it, and one page that explains them all. |

### 25. An annual flagship event

The most accountable edtech company · 0 of 1 in place.

| ID | Item | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| B25-1 | An annual flagship event on student clarity, accessible learning, responsible AI, navigation, interoperability, trustworthy edtech and data agency — virtual and small at first. | owed | — | No date, no programme, no attendee. The clinics and council on the research page are the small start; announcing an event before one exists would break the site’s own rule. |
